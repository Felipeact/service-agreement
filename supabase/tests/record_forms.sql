-- record-forms: C315, C321, C327, C336. Run after fixture.sql in the same execute_sql call (npm run test:db record_forms).
-- Fixture: siteA names ctA (of custA) as its site contact; ct2A belongs to cust2A and no site names it.

-- C336: a viewer can neither insert, update nor delete customers, contacts, sites or assets.
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C336 viewer insert customers',
    format('insert into public.customers (org_id, name) values (%L, ''V'')', tests.id('orgA')), '42501');
  perform tests.expect_error('C336 viewer insert contacts',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''V'')', tests.id('orgA'), tests.id('custA')), '42501');
  perform tests.expect_error('C336 viewer insert sites',
    format('insert into public.sites (org_id, customer_id, name) values (%L, %L, ''V'')', tests.id('orgA'), tests.id('custA')), '42501');
  perform tests.expect_error('C336 viewer insert assets',
    format('insert into public.assets (org_id, site_id, asset_type_id) values (%L, %L, %L)', tests.id('orgA'), tests.id('siteA'), tests.id('typeA')), '42501');

  perform tests.expect_rows('C336 viewer update customers', format('update public.customers set name = ''V'' where id = %L', tests.id('custA')), 0);
  perform tests.expect_rows('C336 viewer update contacts', format('update public.contacts set name = ''V'' where id = %L', tests.id('ctA')), 0);
  perform tests.expect_rows('C336 viewer update sites', format('update public.sites set name = ''V'' where id = %L', tests.id('siteA')), 0);
  perform tests.expect_rows('C336 viewer update assets', format('update public.assets set location = ''V'' where id = %L', tests.id('assetA')), 0);

  perform tests.expect_rows('C336 viewer delete customers', format('delete from public.customers where id = %L', tests.id('custA')), 0);
  perform tests.expect_rows('C336 viewer delete contacts', format('delete from public.contacts where id = %L', tests.id('ctA')), 0);
  perform tests.expect_rows('C336 viewer delete sites', format('delete from public.sites where id = %L', tests.id('siteA')), 0);
  perform tests.expect_rows('C336 viewer delete assets', format('delete from public.assets where id = %L', tests.id('assetA')), 0);
end $$;

-- C336: an owner cannot attach a row to another org's parent, nor change another org's row.
reset role;
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C336 foreign parent',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''X'')', tests.id('orgA'), tests.id('custB')), '23503');
  perform tests.expect_rows('C336 foreign asset update', format('update public.assets set location = ''X'' where id = %L', tests.id('assetB')), 0);
end $$;

-- C336, C321, C315, C327: an estimator writes all four, within the composite keys.
reset role;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C336 estimator insert customers',
    format('insert into public.customers (org_id, name) values (%L, ''E'')', tests.id('orgA')), 1);
  perform tests.expect_rows('C336 estimator insert contacts',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''E'')', tests.id('orgA'), tests.id('custA')), 1);
  perform tests.expect_rows('C336 estimator insert sites',
    format('insert into public.sites (org_id, customer_id, name) values (%L, %L, ''E'')', tests.id('orgA'), tests.id('custA')), 1);
  perform tests.expect_rows('C336 estimator insert assets',
    format('insert into public.assets (org_id, site_id, asset_type_id) values (%L, %L, %L)', tests.id('orgA'), tests.id('siteA'), tests.id('typeA')), 1);

  perform tests.expect_error('C321 insert with another customer''s contact',
    format('insert into public.sites (org_id, customer_id, site_contact_id, name) values (%L, %L, %L, ''E'')',
      tests.id('orgA'), tests.id('custA'), tests.id('ct2A')), '23503');
  perform tests.expect_error('C321 update to another customer''s contact',
    format('update public.sites set site_contact_id = %L where id = %L', tests.id('ct2A'), tests.id('siteA')), '23503');

  perform tests.expect_error('C315 delete a site contact',
    format('delete from public.contacts where id = %L', tests.id('ctA')), '23503');
  perform tests.ok('C315 site contact kept', (select count(*) from public.contacts where id = tests.id('ctA')) = 1, 'ctA was deleted');
  perform tests.expect_rows('C315 delete an unused contact', format('delete from public.contacts where id = %L', tests.id('ct2A')), 1);

  perform tests.expect_rows('C327 delete an asset', format('delete from public.assets where id = %L', tests.id('assetA')), 1);
end $$;
reset role;

rollback;
select 'record_forms: pass' as result;
