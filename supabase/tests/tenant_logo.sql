-- tenant-logo, database side: C3300-C3307 (.specs/features/tenant-logo/checks.md).
-- Run after fixture.sql and the migration (npm run test:db tenant_logo): the recipe puts
-- migrations/20261111100000_tenant_logo.sql between them, inside the rolled-back transaction, until the owner applies it.
-- Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB. uAd (admin of A) is made here.
-- C3312 and C3314 also appear here for the database half: the delete the app asks of Storage must remove a row.
-- Expected values come from the plan, never read back from the migration. Storage's own size and type refusal is a Storage
-- service behaviour a SQL recipe cannot drive: C3302 asserts the bucket configuration, C3339 observes the refusal live.

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@logo.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

create function tests.lg_key(p_org text, p_name text, p_ext text) returns text
language sql immutable as $$ select tests.id(p_org)::text || '/' || tests.id(p_name)::text || '.' || p_ext $$;

create function tests.lg_insert_sql(p_key text) returns text
language sql immutable as $$
  select format('insert into storage.objects (bucket_id, name, owner) values (''logos'', %L, null)', p_key)
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Storage refuses a direct delete unless this is set (its own guard); the policies are what C3301 asserts.
select set_config('storage.allow_delete_query', 'true', true);

-- C3300: an owner and an admin each store a PNG and a JPEG under their own org's folder.
do $$
declare
  v_user text;
  v_ext text;
begin
  foreach v_user in array array['uA', 'uAd'] loop
    foreach v_ext in array array['png', 'jpg'] loop
      perform tests.act_as(v_user);
      execute tests.lg_insert_sql(tests.lg_key('orgA', 'ok:' || v_user || v_ext, v_ext));
      reset role;
    end loop;
  end loop;
  perform tests.ok('C3300 four objects', (select count(*) from storage.objects where bucket_id = 'logos' and name like tests.id('orgA')::text || '/%') = 4,
    'an owner or admin could not store a logo');
end $$;

-- C3301: an estimator, a viewer, another org's owner and anon cannot insert; none of them removes a row by deleting.
do $$
declare
  v_user text;
  v_key text := tests.lg_key('orgA', 'ok:uApng', 'png');
  v_n integer;
begin
  foreach v_user in array array['uE', 'uV', 'uB'] loop
    perform tests.act_as(v_user);
    perform tests.expect_error('C3301 insert ' || v_user, tests.lg_insert_sql(tests.lg_key('orgA', 'bad:' || v_user, 'png')), '42501');
    delete from storage.objects where bucket_id = 'logos' and name = v_key;
    get diagnostics v_n = row_count;
    perform tests.ok('C3301 delete ' || v_user, v_n = 0, 'rows deleted: ' || v_n);
    reset role;
  end loop;
  perform tests.act_as_anon();
  perform tests.expect_error('C3301 insert anon', tests.lg_insert_sql(tests.lg_key('orgA', 'bad:anon', 'png')), '42501');
  delete from storage.objects where bucket_id = 'logos' and name = v_key;
  get diagnostics v_n = row_count;
  perform tests.ok('C3301 delete anon', v_n = 0, 'rows deleted: ' || v_n);
  reset role;
  perform tests.ok('C3301 object kept', exists (select 1 from storage.objects where bucket_id = 'logos' and name = v_key), 'the object was removed');
end $$;

-- C3302: the bucket's limits.
do $$
declare b storage.buckets;
begin
  select * into b from storage.buckets where id = 'logos';
  perform tests.ok('C3302 exists', b.id is not null, 'no logos bucket');
  perform tests.ok('C3302 size', b.file_size_limit = 1048576, 'limit ' || coalesce(b.file_size_limit::text, 'null'));
  perform tests.ok('C3302 types', (select array_agg(t order by t) from unnest(b.allowed_mime_types) t) = array['image/jpeg', 'image/png'],
    'types ' || coalesce(b.allowed_mime_types::text, 'null'));
end $$;

-- C3303: a malformed first segment and another org's folder are policy refusals, not cast errors.
do $$
begin
  perform tests.act_as('uA');
  perform tests.expect_error('C3303 not a uuid', tests.lg_insert_sql('not-a-uuid/' || tests.id('x')::text || '.png'), '42501');
  perform tests.expect_error('C3303 empty segment', tests.lg_insert_sql('/' || tests.id('x')::text || '.png'), '42501');
  perform tests.expect_error('C3303 other org', tests.lg_insert_sql(tests.lg_key('orgB', 'x', 'png')), '42501');
  reset role;
end $$;

-- C3304: the shape of logo_path.
do $$
declare
  v_org uuid := tests.id('orgA');
  v_good text := tests.lg_key('orgA', 'shape', 'png');
  v_bad text;
begin
  update public.org_settings set logo_path = null where org_id = v_org;
  update public.org_settings set logo_path = v_good where org_id = v_org;
  update public.org_settings set logo_path = tests.lg_key('orgA', 'shape', 'jpg') where org_id = v_org;
  foreach v_bad in array array[
    tests.lg_key('orgB', 'shape', 'png'),
    v_org::text || '/logo.png',
    v_org::text || '/' || tests.id('shape')::text || '.svg',
    tests.id('shape')::text || '.png',
    '/' || v_org::text || '/' || tests.id('shape')::text || '.png'
  ] loop
    perform tests.expect_error('C3304 ' || v_bad, format('update public.org_settings set logo_path = %L where org_id = %L', v_bad, v_org), '23514');
  end loop;
  perform tests.ok('C3304 kept', (select logo_path from public.org_settings where org_id = v_org) = tests.lg_key('orgA', 'shape', 'jpg'), 'a refused value changed the row');
  update public.org_settings set logo_path = null where org_id = v_org;
end $$;

-- C3305: public read needs no session: the bucket is public and no policy of the table selects from it.
do $$
begin
  perform tests.ok('C3305 public', (select public from storage.buckets where id = 'logos') is true, 'the bucket is not public');
  perform tests.ok('C3305 select policies are for authenticated only', not exists (select 1 from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and cmd in ('SELECT', 'ALL') and (qual like '%logos%' or with_check like '%logos%')
    and not (roles = array['authenticated']::name[])), 'a select policy on logos reaches another role');
end $$;

-- C3305, C3301: the API selects nothing for anon, an estimator, a viewer or another org's owner; an owner and an admin see their objects.
do $$
declare
  v_user text;
begin
  foreach v_user in array array['uE', 'uV', 'uB'] loop
    perform tests.act_as(v_user);
    perform tests.ok('C3305 select ' || v_user, (select count(*) from storage.objects where bucket_id = 'logos' and name like tests.id('orgA')::text || '/%') = 0, 'rows visible');
    reset role;
  end loop;
  perform tests.act_as_anon();
  perform tests.ok('C3305 select anon', (select count(*) from storage.objects where bucket_id = 'logos') = 0, 'rows visible');
  reset role;
  foreach v_user in array array['uA', 'uAd'] loop
    perform tests.act_as(v_user);
    perform tests.ok('C3305 select ' || v_user, (select count(*) from storage.objects where bucket_id = 'logos' and name like tests.id('orgA')::text || '/%') >= 4, 'rows hidden');
    reset role;
  end loop;
end $$;

-- C3312, C3314: Storage's remove is a delete that must find the row: an owner and an admin each remove their org's object.
do $$
declare
  v_user text;
  v_n integer;
begin
  foreach v_user in array array['uA', 'uAd'] loop
    perform tests.act_as(v_user);
    delete from storage.objects where bucket_id = 'logos' and name = tests.lg_key('orgA', 'ok:' || v_user || 'jpg', 'jpg');
    get diagnostics v_n = row_count;
    perform tests.ok('C3312 delete ' || v_user, v_n = 1, 'rows deleted: ' || v_n);
    reset role;
  end loop;
end $$;

-- C3306: the customer's review reads the path.
do $$
declare
  v_name text := 'lg1';
  v_hash text := encode(sha256(convert_to(v_name, 'UTF8')), 'hex');
  v jsonb;
begin
  perform tests.pe_sent(v_name, date '2099-01-01');
  update public.org_settings set logo_path = tests.lg_key('orgA', 'portal', 'png') where org_id = tests.id('orgA');
  perform tests.act_as_anon();
  v := public.portal_view(v_hash);
  reset role;
  perform tests.ok('C3306 path', v #>> '{tenant,logoPath}' = tests.lg_key('orgA', 'portal', 'png'), 'logoPath ' || coalesce(v #>> '{tenant,logoPath}', 'null'));
  perform tests.ok('C3306 other keys', v #>> '{tenant,name}' = (select legal_name from public.org_settings where org_id = tests.id('orgA'))
    and v -> 'tenant' ? 'address' and v -> 'tenant' ? 'phone' and v -> 'tenant' ? 'accent'
    and v #>> '{tenant,itemSingular}' = 'equipment' and v #>> '{tenant,itemPlural}' = 'equipment', 'a tenant key changed: ' || (v -> 'tenant')::text);
  update public.org_settings set logo_path = null where org_id = tests.id('orgA');
  perform tests.act_as_anon();
  v := public.portal_view(v_hash);
  reset role;
  perform tests.ok('C3306 null', v -> 'tenant' ? 'logoPath' and jsonb_typeof(v #> '{tenant,logoPath}') = 'null', 'tenant ' || (v -> 'tenant')::text);
end $$;

-- C3307: the customer's signing page reads the path.
create function tests.lg_hash(p_name text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_name, 'UTF8')), 'hex') $$;

create function tests.lg_sealed(p_body text) returns text
language sql immutable as $$ select 'v1.AAAAAAAAAAAAAAAA.' || p_body $$;

grant execute on function tests.lg_hash(text), tests.lg_sealed(text) to anon, authenticated;

do $$
declare
  v_agr uuid := tests.rn_agreement('lg2', 'A', '2027-01-01', '{"cpiCapPct": 5, "cpiRenegotiationThresholdPct": 5, "renewalNoticeDays": 30}'::jsonb, 'pat@customer.ca');
  v_contract uuid;
  v_request uuid;
  v jsonb;
begin
  perform tests.act_as('uE');
  v_contract := public.create_contract(v_agr);
  reset role;
  perform tests.act_as('uA');
  v_request := public.begin_signature_request(v_contract, 'Dana Admin', tests.lg_hash(v_contract::text));
  perform public.complete_signature_request(v_request, '13226499', jsonb_build_array(
    jsonb_build_object('role', 'customer', 'submitterId', '101', 'embedSealed', tests.lg_sealed('cust')),
    jsonb_build_object('role', 'contractor', 'submitterId', '102', 'embedSealed', tests.lg_sealed('con'))),
    tests.lg_sealed('link'), repeat('a', 64));
  reset role;
  update public.org_settings set logo_path = tests.lg_key('orgA', 'sign', 'jpg') where org_id = tests.id('orgA');
  perform tests.act_as_anon();
  v := public.signature_view(tests.lg_hash(v_contract::text));
  reset role;
  perform tests.ok('C3307 path', v #>> '{tenant,logoPath}' = tests.lg_key('orgA', 'sign', 'jpg'), 'tenant ' || coalesce((v -> 'tenant')::text, 'null'));
  perform tests.ok('C3307 other keys', v #>> '{tenant,name}' = (select legal_name from public.org_settings where org_id = tests.id('orgA'))
    and v -> 'tenant' ? 'address' and v -> 'tenant' ? 'phone' and v -> 'tenant' ? 'accent', 'a tenant key changed: ' || (v -> 'tenant')::text);
  update public.org_settings set logo_path = null where org_id = tests.id('orgA');
  perform tests.act_as_anon();
  v := public.signature_view(tests.lg_hash(v_contract::text));
  reset role;
  perform tests.ok('C3307 null', v -> 'tenant' ? 'logoPath' and jsonb_typeof(v #> '{tenant,logoPath}') = 'null', 'tenant ' || (v -> 'tenant')::text);
end $$;

rollback;
select 'tenant_logo: pass' as result;
