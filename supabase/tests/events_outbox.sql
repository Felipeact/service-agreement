-- S4 event log and outbox: C28-C31. Run after fixture.sql in the same execute_sql call.

-- C31 (as table owner: only the unique constraint decides)
do $$ begin
  perform tests.expect_error('C31',
    format('insert into public.outbox (org_id, event_id) values (%L, %L)', tests.id('orgA'), tests.id('evtA')), '23505');
end $$;

select tests.act_as('uA');

-- C28
do $$ begin
  perform tests.expect_error('C28 update',
    format('update public.events set type = ''x'' where id = %L', tests.id('evtA')), '42501');
  perform tests.expect_error('C28 delete',
    format('delete from public.events where id = %L', tests.id('evtA')), '42501');
end $$;

-- C29
do $$
declare e uuid;
begin
  insert into public.events (org_id, entity_type, entity_id, type)
  values (tests.id('orgA'), 'agreement', tests.id('agrA'), 'agreement.viewed')
  returning id into e;
  perform tests.ok('C29', (select count(*) from public.events where id = e) = 1, 'inserted event not readable');
end $$;

-- C30 as authenticated
do $$ begin
  perform tests.expect_error('C30 authenticated select', 'select count(*) from public.outbox', '42501');
  perform tests.expect_error('C30 authenticated insert', tests.insert_sql('outbox', 'A'), '42501');
  perform tests.expect_error('C30 authenticated update', 'update public.outbox set attempts = attempts + 1', '42501');
  perform tests.expect_error('C30 authenticated delete', 'delete from public.outbox', '42501');
end $$;

reset role;
select tests.act_as_anon();

-- C30 as anon
do $$ begin
  perform tests.expect_error('C30 anon select', 'select count(*) from public.outbox', '42501');
  perform tests.expect_error('C30 anon insert', tests.insert_sql('outbox', 'A'), '42501');
  perform tests.expect_error('C30 anon update', 'update public.outbox set attempts = attempts + 1', '42501');
  perform tests.expect_error('C30 anon delete', 'delete from public.outbox', '42501');
end $$;

reset role;
rollback;
select 'events_outbox: pass' as result;
