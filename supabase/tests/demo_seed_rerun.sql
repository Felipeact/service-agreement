-- catalog-seed S3, second run: C19. Runs after demo_seed.sql and a second copy of the seed body.

-- C19
do $$
declare r record;
begin
  perform tests.ok('C19 rows', (select count(*) from tests.demo_counts) = 17, 'count snapshot is not 17 tables');
  for r in select t, n from tests.demo_counts loop
    perform tests.ok('C19 ' || r.t,
      r.n = case r.t
              when 'orgs' then (select count(*) from public.orgs where id = tests.demo())
              else tests.count(format('select count(*) from public.%I where org_id = %L', r.t, tests.demo()))
            end,
      'count changed on the second run');
  end loop;
end $$;

-- C821 (service-included): the second run changes no snapshot.
do $$ begin
  perform tests.ok('C821 rerun',
    not exists (select 1 from tests.demo_snapshots s join public.agreement_versions v on v.id = s.id
                where v.snapshot::text <> s.snapshot),
    'a snapshot changed on the second run');
  perform tests.ok('C821 guard',
    (select snapshot ->> 'takenAt' from public.agreement_versions where id = md5('demo:version:4')::uuid) = '2026-01-01T00:00:00+00:00',
    'the second run overwrote a version that already held a scope');
end $$;

-- C937 (customer-portal): terms already in a snapshot do not follow the settings on a re-run.
do $$ begin
  perform tests.ok('C937 kept',
    (select snapshot -> 'terms' ->> 'repairDiscountPct' from public.agreement_versions where id = md5('demo:version:4')::uuid) = '99',
    'the second run overwrote the terms of a version that already had them');
  perform tests.ok('C937 still complete',
    not exists (select 1 from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
                where v.org_id = tests.demo() and not (v.snapshot ? 'terms')
                  and not (a.status = 'draft' and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id))),
    'a frozen demo version has no terms after the second run');
end $$;

rollback;
select 'demo_seed: pass' as result;
