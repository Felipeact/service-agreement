-- qa-p1-p2 C7006: a repeat of an earlier row of the same job starts skipped. Run after fixture.sql and the migration
-- 20261116140000_import_duplicates_skipped.sql, which the recipe replays in the rolled-back transaction (not applied to the
-- hosted project). Fixture: org A estimator uE, siteA, typeA (RTU).

reset role;
select set_config('request.jwt.claims', '', true);
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status, table_count, row_count, read_at)
values (tests.id('dupA'), tests.id('orgA'), tests.id('siteA'), 'dupA.csv', 'text/csv', 100, 'parsed', 1, 10, now());
insert into public.asset_types (id, org_id, code, name) values (tests.id('dupB'), tests.id('orgA'), 'DUPB', 'Other type');

create function tests.dup_row(p_type uuid, p_unit text) returns jsonb
language sql as $$
  select jsonb_build_object('asset_type_raw', 'x', 'unit_no', p_unit, 'type_model', null, 'location', null, 'confidence', 'high', 'source_ref', 'Units!2', 'asset_type_id', p_type)
$$;
grant execute on function tests.dup_row(uuid, text) to authenticated;

select tests.act_as('uE');
do $$
declare j uuid := tests.id('dupA');
begin
  -- chunk 1: RTU-1, "rtu 1" (same unit, other punctuation), RTU-2, an untyped RTU-1, then two typed rows with no unit
  perform public.record_extraction_chunk(j, null, 2, jsonb_build_array(
    tests.dup_row(tests.id('typeA'), 'RTU-1'), tests.dup_row(tests.id('typeA'), 'rtu 1'), tests.dup_row(tests.id('typeA'), 'RTU-2'),
    tests.dup_row(null, 'RTU-1'), tests.dup_row(tests.id('typeA'), null), tests.dup_row(tests.id('typeA'), null)));
  perform tests.ok('C7006 skipped by position', (select array_agg(position order by position) from public.import_rows where job_id = j and skipped) = array[2],
    'only row 2 should start skipped, got ' || coalesce((select array_agg(position)::text from public.import_rows where job_id = j and skipped), 'none'));
  -- chunk 2: a repeat of chunk 1's RTU-2, the same unit under another type, and a new unit
  perform public.record_extraction_chunk(j, 1, 2, jsonb_build_array(
    tests.dup_row(tests.id('typeA'), 'RTU-2'), tests.dup_row(tests.id('dupB'), 'RTU-2'), tests.dup_row(tests.id('typeA'), 'RTU-3')));
  perform tests.ok('C7006 across chunks', (select array_agg(position order by position) from public.import_rows where job_id = j and skipped) = array[2, 7],
    'rows 2 and 7 should be skipped, got ' || coalesce((select array_agg(position)::text from public.import_rows where job_id = j and skipped), 'none'));
  perform tests.ok('C7006 first of a key kept', not (select skipped from public.import_rows where job_id = j and position = 1), 'the first RTU-1 was skipped');
  perform tests.ok('C7006 other type kept', not (select skipped from public.import_rows where job_id = j and position = 8), 'the same unit under another type was skipped');
end $$;

rollback;
select 'import_duplicates: pass' as result;
