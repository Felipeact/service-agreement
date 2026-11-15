-- Database-level freeze: C5601-C5616 (.specs/features/db-freeze/checks.md).
-- Run after fixture.sql and the migration 20261115100000_db_freeze.sql, in the same transaction (the recipe replays the migration
-- until the owner applies it to the hosted project). Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB, no billing row.
-- Expected values come from the plan, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@freeze.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

-- Storage refuses a direct delete unless this is set (its own guard); the policies are what is asserted.
select set_config('storage.allow_delete_query', 'true', true);

-- Sets (or creates) an org's billing status, as the table owner.
create function tests.fz_status(p_org text, p_status text) returns void
language plpgsql security definer as $$
begin
  insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade, status)
  values (tests.id('org' || p_org), 'cus_fz_' || p_org, 'sub_fz_' || p_org, 'starter', 2, array['hvac'], false, p_status)
  on conflict (org_id) do update set status = excluded.status;
end $$;

-- Runs p_sql and always rolls it back: 'rows:<n>' when it ran, 'err:<sqlstate>' when it failed.
create function tests.fz_try(p_sql text) returns text
language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    raise exception '%', n using errcode = 'FZ001';
  exception
    when sqlstate 'FZ001' then return 'rows:' || sqlerrm;
    when others then return 'err:' || sqlstate;
  end;
end $$;

-- fz_try as a signed-in user, then back to the table owner.
create function tests.fz_as(p_user text, p_sql text) returns text
language plpgsql as $$
declare r text;
begin
  perform tests.act_as(p_user);
  r := tests.fz_try(p_sql);
  reset role;
  return r;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- C5601: the gate. Frozen, none of the four roles passes; active, each passes for its own role.
do $$
declare
  u record;
begin
  perform tests.fz_status('A', 'canceled');
  for u in select * from (values ('uA', 'owner'), ('uAd', 'admin'), ('uE', 'estimator'), ('uV', 'viewer')) as t(usr, rol) loop
    perform tests.act_as(u.usr);
    perform tests.ok('C5601 frozen ' || u.rol, (select private.has_org_role(tests.id('orgA'), array[u.rol])) = false, 'role still passes');
    reset role;
  end loop;
  perform tests.fz_status('A', 'active');
  for u in select * from (values ('uA', 'owner'), ('uAd', 'admin'), ('uE', 'estimator'), ('uV', 'viewer')) as t(usr, rol) loop
    perform tests.act_as(u.usr);
    perform tests.ok('C5601 active ' || u.rol, (select private.has_org_role(tests.id('orgA'), array[u.rol])) = true, 'role refused');
    reset role;
  end loop;
end $$;

-- C5602: inserts, as the owner. Frozen they fail with 42501; active, the same statement runs.
do $$
declare
  t text;
  v_sql text;
  v_ctl text;
  v_ok int := 0;
begin
  foreach t in array array['org_settings','customers','contacts','sites','asset_types','asset_type_tasks',
                           'assets','agreements','agreement_versions','service_lines','contracts','events','import_jobs','import_rows'] loop
    perform tests.fz_status('A', 'active');
    v_sql := tests.insert_sql(t, 'A');
    v_ctl := tests.fz_as('uA', v_sql);
    if v_ctl = 'err:42501' then
      -- members have no insert path on this table at all (a function writes it), so the freeze adds nothing here
      raise notice 'C5602 % skipped: unfrozen insert already refused', t;
      continue;
    end if;
    if v_ctl = 'rows:1' then v_ok := v_ok + 1; end if;
    perform tests.fz_status('A', 'canceled');
    perform tests.ok('C5602 insert ' || t, tests.fz_as('uA', v_sql) = 'err:42501', 'frozen insert gave ' || tests.fz_as('uA', v_sql));
  end loop;
  perform tests.fz_status('A', 'active');
  perform tests.ok('C5602 control inserted', v_ok >= 10, 'only ' || v_ok || ' of 13 inserts ran unfrozen');
end $$;

-- C5603 fixtures, as the table owner: an extracted job (its rows are editable) and one service-line coverage row.
update public.import_jobs set status = 'extracted', extract_total = 1, extract_cursor = 1, extracted_at = now(), read_at = now(), table_count = 1, row_count = 1 where id = tests.id('jobA');
insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
values (tests.id('orgA'), tests.id('lineA'), tests.id('typeA'));

-- C5603: updates and deletes, as the owner, over the 16 tables with a has_org_role write policy.
do $$
declare
  t text;
  v_upd text;
  v_del text;
  v_a uuid := tests.id('orgA');
  v_exercised int := 0;
  v_frozen text;
  v_ctl text;
  v_skipped text[] := '{}';
begin
  foreach t in array array['agreement_versions','agreements','asset_type_tasks','asset_types','assets','contacts','contracts','customers',
                           'events','import_jobs','import_rows','org_settings','orgs','service_line_asset_types','service_lines','sites'] loop
    if t = 'orgs' then
      v_upd := format('update public.orgs set name = name where id = %L', v_a);
      v_del := format('delete from public.orgs where id = %L', v_a);
    else
      -- members have no grant on org_id for these three, so they update another column (C12 does the same)
      v_upd := format('update public.%I set %s = %s where org_id = %L', t,
        case t when 'assets' then 'unit_no' when 'customers' then 'name' when 'sites' then 'name' else 'org_id' end,
        case t when 'assets' then 'unit_no' when 'customers' then 'name' when 'sites' then 'name' else 'org_id' end, v_a);
      v_del := format('delete from public.%I where org_id = %L', t, v_a);
    end if;
    perform tests.fz_status('A', 'active');
    v_ctl := tests.fz_as('uA', v_upd);
    if v_ctl like 'rows:%' and v_ctl <> 'rows:0' then
      v_exercised := v_exercised + 1;
      perform tests.fz_status('A', 'canceled');
      v_frozen := tests.fz_as('uA', v_upd);
      perform tests.ok('C5603 update ' || t, v_frozen in ('rows:0', 'err:42501'), 'got ' || v_frozen);
      v_frozen := tests.fz_as('uA', v_del);
      perform tests.ok('C5603 delete ' || t, v_frozen in ('rows:0', 'err:42501'), 'got ' || v_frozen);
      perform tests.fz_status('A', 'active');
    else
      v_skipped := v_skipped || (t || '=' || v_ctl);
    end if;
  end loop;
  perform tests.ok('C5603 control', v_exercised >= 13, 'only ' || v_exercised || ' of 16 tables exercised; skipped ' || v_skipped::text);
  -- rows are unchanged: the fixture customer is still there
  perform tests.ok('C5603 rows kept', tests.count(format('select count(*) from public.customers where org_id = %L', v_a)) >= 2, 'rows gone');
end $$;

-- C5603, agreement_versions: members cannot update it (grant revoked) but a delete still reaches the policy (an unfrozen one stops at a foreign key, 23503).
do $$
declare v_del text := format('delete from public.agreement_versions where org_id = %L', tests.id('orgA'));
begin
  perform tests.fz_status('A', 'active');
  perform tests.ok('C5603 control agreement_versions', tests.fz_as('uA', v_del) <> 'err:42501', 'unfrozen delete refused by the policy');
  perform tests.fz_status('A', 'canceled');
  perform tests.ok('C5603 delete agreement_versions', tests.fz_as('uA', v_del) = 'rows:0', 'got ' || tests.fz_as('uA', v_del));
  perform tests.fz_status('A', 'active');
end $$;

-- C5604: write functions, as the owner. Frozen they raise 42501; active they pass the role check (any other outcome).
do $$
declare
  c record;
  r text;
begin
  for c in select * from (values
    ('create_agreement', format('select public.create_agreement(%L, null)', tests.id('siteA'))),
    ('save_service_line', format('select public.save_service_line(%L, null, ''x'', ''{3,6}''::smallint[], 1000, ''{}''::uuid[])', tests.id('agrA'))),
    ('create_invitation', 'select public.create_invitation(''new.person@example.test'', ''estimator'')'),
    ('set_member_role', format('select public.set_member_role(%L, ''viewer'')', tests.id('uE'))),
    ('save_contract_template', 'select public.save_contract_template(''{}''::jsonb)'),
    ('set_org_plan', 'select public.set_org_plan(''team'', 5)')) as t(fn, q) loop
    perform tests.fz_status('A', 'canceled');
    r := tests.fz_as('uA', c.q);
    perform tests.ok('C5604 frozen ' || c.fn, r = 'err:42501', 'got ' || r);
    perform tests.fz_status('A', 'active');
    r := tests.fz_as('uA', c.q);
    perform tests.ok('C5604 active ' || c.fn, r <> 'err:42501', 'role check refused: ' || r);
  end loop;
end $$;

-- C5605: every writer goes through the gate. The 37 names are those that mention has_org_role( today; none may use the read-only twin.
do $$
declare
  v_names text[] := array[
    'public.add_catalog_draft','public.add_catalog_types','public.apply_agreement_transition','public.apply_contract_transition',
    'public.archive_agreement_template','public.begin_signature_request','public.commit_import','public.complete_signature_request',
    'public.contractor_signing_source','public.create_agreement','public.create_contract','public.create_invitation',
    'public.create_task_library_type','public.customer_signing_link','public.fail_signature_request','public.import_allowance',
    'public.record_extraction_chunk','public.reissue_portal_link','public.revoke_invitation','public.save_agreement_template',
    'public.save_agreement_term','public.save_contract_template','public.save_service_line','public.save_task_library_type',
    'public.save_version_note','public.set_asset_active','public.set_customer_active','public.set_member_role','public.set_org_plan',
    'public.set_site_active',
    'private.assert_agreement_capacity','private.asset_types_code_frozen','private.freeze_agreement_version','private.issue_portal_link',
    'private.library_type_for_write','private.pin_system_agreement_template','private.stamp_valid_until'];
  n text;
  v_found text[];
  v_unlisted text[];
begin
  perform tests.ok('C5605 listed', cardinality(v_names) = 37, 'list has ' || cardinality(v_names));
  foreach n in array v_names loop
    perform tests.ok('C5605 ' || n,
      exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname || '.' || p.proname = n and p.prosrc ~ 'has_org_role\s*\('),
      'does not call private.has_org_role');
    perform tests.ok('C5605 twin ' || n,
      not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                  where s.nspname || '.' || p.proname = n and p.prosrc ~ 'has_org_role_any_state'),
      'uses the read-only twin');
  end loop;
  -- a function added later must be classified: nothing outside the list calls the gate
  select coalesce(array_agg(s.nspname || '.' || p.proname order by 1), '{}') into v_unlisted
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname in ('public', 'private') and p.prosrc ~ 'has_org_role\s*\(' and (s.nspname || '.' || p.proname) <> all (v_names)
    and p.proname <> 'has_org_role';
  perform tests.ok('C5605 unlisted', v_unlisted = '{}', 'unclassified: ' || v_unlisted::text);
end $$;

-- C5606: storage writes, as the owner, in both buckets with a write policy. The imports policy wants an uploading job of the org.
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes)
values (tests.id('fz_job'), tests.id('orgA'), tests.id('siteA'), 'fz.csv', 'text/csv', 100);

do $$
declare
  b text;
  v_key text;
  v_ins text;
  v_del text;
begin
  foreach b in array array['imports', 'logos'] loop
    -- the imports policy wants the object named after an uploading job of the org; the logos one wants <uuid>.png
    v_key := tests.id('orgA')::text || '/' || case b when 'logos' then tests.id('fz_logos')::text || '.png' else tests.id('fz_job')::text end;
    v_ins := format('insert into storage.objects (bucket_id, name, owner) values (%L, %L, null)', b, v_key);
    v_del := format('delete from storage.objects where bucket_id = %L and name = %L', b, v_key);
    perform tests.fz_status('A', 'canceled');
    perform tests.ok('C5606 ' || b || ' insert', tests.fz_as('uA', v_ins) like 'err:%', 'insert allowed');
    perform tests.fz_status('A', 'active');
    perform tests.ok('C5606 ' || b || ' control insert', tests.fz_as('uA', v_ins) = 'rows:1', 'got ' || tests.fz_as('uA', v_ins));
    execute v_ins;
    perform tests.fz_status('A', 'canceled');
    perform tests.ok('C5606 ' || b || ' delete', tests.fz_as('uA', v_del) = 'rows:0', 'got ' || tests.fz_as('uA', v_del));
    perform tests.fz_status('A', 'active');
    perform tests.ok('C5606 ' || b || ' control delete', tests.fz_as('uA', v_del) = 'rows:1', 'got ' || tests.fz_as('uA', v_del));
  end loop;
end $$;

-- C5607: a frozen org's members can still read every table.
do $$
declare t text;
begin
  perform tests.fz_status('A', 'canceled');
  perform tests.act_as('uA');
  foreach t in array array_remove(tests.tenant_tables(), 'outbox') loop
    perform tests.ok('C5607 read ' || t,
      tests.count(format('select count(*) from public.%I where org_id = %L', t, tests.id('orgA'))) >= 1, 'no rows visible');
  end loop;
  reset role;
  perform tests.fz_status('A', 'active');
end $$;

-- C5608: an org with no billing row is never frozen.
do $$
begin
  perform tests.ok('C5608 no billing row', not exists (select 1 from public.org_billing where org_id = tests.id('orgB')), 'fixture drifted');
  perform tests.ok('C5608 not frozen', private.org_is_frozen(tests.id('orgB')) = false, 'org without billing is frozen');
  perform tests.ok('C5608 writable',
    tests.fz_as('uB', format('update public.customers set name = name where id = %L', tests.id('custB'))) = 'rows:1', 'write refused');
end $$;

-- C5609: a frozen owner still reads Billing, invitations, usage and the logo; other roles still do not read billing.
do $$
declare
  v_org uuid := tests.id('orgA');
  v_logo text := v_org::text || '/' || tests.id('fz_read')::text || '.png';
begin
  perform tests.fz_status('A', 'active');
  perform tests.act_as('uA');
  perform public.create_invitation('pending.person@example.test', 'estimator');
  reset role;
  insert into storage.objects (bucket_id, name, owner) values ('logos', v_logo, null);
  perform tests.fz_status('A', 'canceled');

  perform tests.act_as('uA');
  perform tests.ok('C5609 org_billing owner', (select count(*) from public.org_billing) = 1, 'billing row hidden');
  perform tests.ok('C5609 invitations policy', (select count(*) from public.invitations where email = 'pending.person@example.test') = 1, 'invitation hidden');
  perform tests.ok('C5609 list_invitations', (select count(*) from public.list_invitations() where email = 'pending.person@example.test') = 1, 'list empty');
  perform tests.ok('C5609 org_usage', public.org_usage() ->> 'plan' = 'starter', 'usage wrong');
  perform tests.ok('C5609 logos select', (select count(*) from storage.objects where bucket_id = 'logos' and name = v_logo) = 1, 'logo hidden');
  reset role;

  perform tests.act_as('uE');
  perform tests.ok('C5609 org_billing estimator', (select count(*) from public.org_billing) = 0, 'estimator reads billing');
  reset role;
  perform tests.act_as('uV');
  perform tests.ok('C5609 org_billing viewer', (select count(*) from public.org_billing) = 0, 'viewer reads billing');
  reset role;
  perform tests.fz_status('A', 'active');
end $$;

-- C5610: the read set is exactly five objects.
do $$
declare
  v_pol text[];
  v_fn text[];
begin
  select coalesce(array_agg(policyname order by policyname), '{}') into v_pol
  from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ~ 'has_org_role_any_state';
  perform tests.ok('C5610 policies', v_pol = array['invitations_select', 'logos_select', 'org_billing_select'], v_pol::text);
  select coalesce(array_agg(p.proname order by p.proname), '{}') into v_fn
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname in ('public', 'private') and p.prosrc ~ 'has_org_role_any_state' and p.proname <> 'has_org_role_any_state';
  perform tests.ok('C5610 functions', v_fn = array['list_invitations', 'org_usage'], v_fn::text);
end $$;

-- C5611: a renewal checkout thaws the org, and the owner can write again.
do $$
begin
  perform tests.fz_status('A', 'canceled');
  insert into private.stripe_events (id, type, body) values (
    'evt_fz_renew', 'checkout.session.completed',
    jsonb_build_object('id', 'evt_fz_renew', 'type', 'checkout.session.completed', 'created', 100,
      'data', jsonb_build_object('object', jsonb_build_object('customer', 'cus_fz_A', 'subscription', 'sub_fz_new',
        'metadata', jsonb_build_object('sa_renew_org', tests.id('orgA'))))));
  perform tests.ok('C5611 status', (select status from public.org_billing where org_id = tests.id('orgA')) = 'active', 'still frozen');
  perform tests.ok('C5611 write after renewal',
    tests.fz_as('uA', format('update public.customers set name = name where id = %L', tests.id('custA'))) = 'rows:1', 'write refused');
end $$;

-- C5612: another org's cancellation freezes only that org.
do $$
begin
  perform tests.fz_status('A', 'active');
  perform tests.fz_status('B', 'active');
  insert into private.stripe_events (id, type, body) values (
    'evt_fz_cancel_b', 'customer.subscription.deleted',
    jsonb_build_object('id', 'evt_fz_cancel_b', 'type', 'customer.subscription.deleted', 'created', 200,
      'data', jsonb_build_object('object', jsonb_build_object('id', 'sub_fz_B', 'status', 'canceled'))));
  perform tests.ok('C5612 B refused',
    tests.fz_as('uB', format('update public.customers set name = name where id = %L', tests.id('custB'))) = 'rows:0', 'B still writable');
  perform tests.ok('C5612 A writable',
    tests.fz_as('uA', format('update public.customers set name = name where id = %L', tests.id('custA'))) = 'rows:1', 'A frozen');
end $$;

-- C5613 and C5615: the status set, in the database. 'something_new' stands for a status Stripe adds later.
do $$
declare
  s record;
  v_expect boolean;
begin
  for s in select * from (values ('active', false), ('trialing', false), ('past_due', false), ('incomplete', false), ('paused', false),
                                 ('canceled', true), ('unpaid', true), ('incomplete_expired', true), ('something_new', false)) as t(st, frozen) loop
    perform tests.fz_status('A', s.st);
    v_expect := s.frozen;
    perform tests.ok(case when s.st = 'something_new' then 'C5615 unknown status' else 'C5613 org_is_frozen ' || s.st end,
      private.org_is_frozen(tests.id('orgA')) = v_expect, 'org_is_frozen wrong for ' || s.st);
    perform tests.act_as('uA');
    perform tests.ok('C5613 my_org_frozen ' || s.st, public.my_org_frozen() = v_expect, 'my_org_frozen wrong for ' || s.st);
    reset role;
  end loop;
  perform tests.fz_status('A', 'active');
end $$;

-- C5616: the literal shape of both doors.
do $$
declare
  f text;
begin
  foreach f in array array['private.org_is_frozen(uuid)', 'private.has_org_role_any_state(uuid, text[])'] loop
    perform tests.ok('C5616 ' || f || ' definer', (select prosecdef from pg_proc where oid = f::regprocedure), 'not security definer');
    perform tests.ok('C5616 ' || f || ' stable', (select provolatile from pg_proc where oid = f::regprocedure) = 's', 'not stable');
    perform tests.ok('C5616 ' || f || ' search_path', (select proconfig from pg_proc where oid = f::regprocedure) @> array['search_path=""'], 'search_path not empty');
    perform tests.ok('C5616 ' || f || ' anon', has_function_privilege('anon', f::regprocedure, 'execute') = false, 'anon can execute');
    perform tests.ok('C5616 ' || f || ' authenticated', has_function_privilege('authenticated', f::regprocedure, 'execute') = true, 'authenticated cannot');
  end loop;
  perform tests.ok('C5616 has_org_role signature', to_regprocedure('private.has_org_role(uuid, text[])') is not null, 'signature changed');
  perform tests.act_as_anon();
  perform tests.ok('C5616 anon call', tests.fz_try('select private.org_is_frozen(null)') = 'err:42501', 'anon call allowed');
  reset role;
end $$;

reset role;
rollback;
select 'db_freeze: pass' as result;
