-- contact-roles, database side: C1463-C1467 (.specs/features/contact-roles/checks.md). Run after fixture.sql in the same
-- execute_sql call (npm run test:db contact_roles). Fixture: siteA (site contact ctA) and custA; ct2A belongs to cust2A;
-- org A owner uA, estimator uE, viewer uV; org B owner uB. The notification claims (C1468-C1474) are in outbox_dispatch.sql.

reset role;
select set_config('request.jwt.claims', '', true);

-- A site <p_name>:site of custA with an approver and/or a site contact, each with its email (null: no email).
create function tests.cr_site(p_name text, p_approver boolean, p_approver_email text, p_site boolean, p_site_email text)
returns uuid
language plpgsql as $$
begin
  if p_approver then
    insert into public.contacts (id, org_id, customer_id, name, email)
    values (tests.id(p_name || ':ap'), tests.id('orgA'), tests.id('custA'), 'Approver ' || p_name, p_approver_email);
  end if;
  if p_site then
    insert into public.contacts (id, org_id, customer_id, name, email)
    values (tests.id(p_name || ':sc'), tests.id('orgA'), tests.id('custA'), 'Site ' || p_name, p_site_email);
  end if;
  insert into public.sites (id, org_id, customer_id, site_contact_id, approver_contact_id, name)
  values (tests.id(p_name || ':site'), tests.id('orgA'), tests.id('custA'),
          case when p_site then tests.id(p_name || ':sc') end, case when p_approver then tests.id(p_name || ':ap') end, 'Site ' || p_name);
  return tests.id(p_name || ':site');
end $$;

-- C1463: each role stores a contact of the same customer and refuses a contact of another customer with 23503.
do $$
begin
  update public.sites set approver_contact_id = tests.id('ctA') where id = tests.id('siteA');
  perform tests.ok('C1463 site approver stored', (select approver_contact_id from public.sites where id = tests.id('siteA')) = tests.id('ctA'),
    'the approver was not stored');
  perform tests.expect_error('C1463 site approver of another customer',
    format('update public.sites set approver_contact_id = %L where id = %L', tests.id('ct2A'), tests.id('siteA')), '23503');
  update public.customers set billing_contact_id = tests.id('ctA') where id = tests.id('custA');
  perform tests.ok('C1463 customer billing stored', (select billing_contact_id from public.customers where id = tests.id('custA')) = tests.id('ctA'),
    'the billing contact was not stored');
  perform tests.expect_error('C1463 billing contact of another customer',
    format('update public.customers set billing_contact_id = %L where id = %L', tests.id('ct2A'), tests.id('custA')), '23503');
  update public.sites set approver_contact_id = null where id = tests.id('siteA');
  update public.customers set billing_contact_id = null where id = tests.id('custA');
end $$;

-- C1464: a contact that is an approver, or a billing contact, cannot be deleted.
select tests.cr_site('c1464', true, 'ap@customer.ca', true, 'sc@customer.ca');
insert into public.contacts (id, org_id, customer_id, name) values (tests.id('c1464:bill'), tests.id('orgA'), tests.id('custA'), 'Billing c1464');
update public.customers set billing_contact_id = tests.id('c1464:bill') where id = tests.id('custA');
do $$
begin
  perform tests.expect_error('C1464 approver', format('delete from public.contacts where id = %L', tests.id('c1464:ap')), '23503');
  perform tests.expect_error('C1464 billing', format('delete from public.contacts where id = %L', tests.id('c1464:bill')), '23503');
  perform tests.ok('C1464 both remain', tests.count(format('select count(*) from public.contacts where id in (%L, %L)',
    tests.id('c1464:ap'), tests.id('c1464:bill'))) = 2, 'a role holder was deleted');
end $$;
update public.customers set billing_contact_id = null where id = tests.id('custA');

-- C1465: an estimator sets both roles; a viewer's update changes no row.
select tests.act_as('uE');
do $$
begin
  perform tests.expect_rows('C1465 estimator site', format('update public.sites set approver_contact_id = %L where id = %L',
    tests.id('c1464:ap'), tests.id('c1464:site')), 1);
  perform tests.expect_rows('C1465 estimator customer', format('update public.customers set billing_contact_id = %L where id = %L',
    tests.id('c1464:bill'), tests.id('custA')), 1);
end $$;
reset role;
select tests.act_as('uV');
do $$
begin
  perform tests.expect_rows('C1465 viewer site', format('update public.sites set approver_contact_id = null where id = %L', tests.id('c1464:site')), 0);
  perform tests.expect_rows('C1465 viewer customer', format('update public.customers set billing_contact_id = null where id = %L', tests.id('custA')), 0);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform tests.ok('C1465 viewer left both', (select approver_contact_id from public.sites where id = tests.id('c1464:site')) = tests.id('c1464:ap')
    and (select billing_contact_id from public.customers where id = tests.id('custA')) = tests.id('c1464:bill'), 'a viewer changed a role');
end $$;

-- C1466: who a customer email goes to, for six cases.
select tests.cr_site('c66a', true, '  ap@customer.ca  ', true, 'sc@customer.ca');
select tests.cr_site('c66b', true, 'ap@customer.ca', false, null);
select tests.cr_site('c66c', true, '   ', true, 'sc@customer.ca');
select tests.cr_site('c66d', false, null, true, 'sc@customer.ca');
select tests.cr_site('c66e', false, null, false, null);
select tests.cr_site('c66f', true, ' ', true, '');
do $$
begin
  perform tests.ok('C1466 both emails', private.customer_recipient(tests.id('c66a:site')) = 'ap@customer.ca',
    'got ' || coalesce(private.customer_recipient(tests.id('c66a:site')), 'null'));
  perform tests.ok('C1466 approver only', private.customer_recipient(tests.id('c66b:site')) = 'ap@customer.ca', 'approver without site contact');
  perform tests.ok('C1466 approver blank', private.customer_recipient(tests.id('c66c:site')) = 'sc@customer.ca', 'blank approver did not fall back');
  perform tests.ok('C1466 no approver', private.customer_recipient(tests.id('c66d:site')) = 'sc@customer.ca', 'no approver did not fall back');
  perform tests.ok('C1466 neither', private.customer_recipient(tests.id('c66e:site')) is null, 'no contacts gave an address');
  perform tests.ok('C1466 both blank', private.customer_recipient(tests.id('c66f:site')) is null, 'blank emails gave an address');
end $$;

-- C1467: the resolver is not callable by the API roles.
do $$
begin
  perform tests.ok('C1467 anon', not has_function_privilege('anon', 'private.customer_recipient(uuid)', 'execute'), 'anon can execute');
  perform tests.ok('C1467 authenticated', not has_function_privilege('authenticated', 'private.customer_recipient(uuid)', 'execute'),
    'authenticated can execute');
end $$;

rollback;
select 'contact_roles: pass' as result;
