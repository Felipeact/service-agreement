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

rollback;
select 'demo_seed: pass' as result;
