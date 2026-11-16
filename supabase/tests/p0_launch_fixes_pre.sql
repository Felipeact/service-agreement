-- p0-launch-fixes setup that must exist BEFORE the migration runs, so its backfill and its "leaves old snapshots alone" promise
-- are proven against data that was there first (C6012, C6021). Run after fixture.sql and before the migration in the recipe.

-- Three orgs with company details: orgC real, orgD the demo seed's values, orgE a real name and address but no phone.
insert into public.orgs (id, name) values
  (tests.id('orgC'), 'Acme Heating (test)'),
  (tests.id('orgD'), 'Kettle Ridge Mechanical Ltd. (test)'),
  (tests.id('orgE'), 'Phoneless Plumbing (test)');
insert into public.org_settings (org_id, legal_name, address, phone) values
  (tests.id('orgC'), 'Acme Heating Ltd.', '12 Main St, Surrey, BC V3T 1A1', '604-555-2368'),
  (tests.id('orgD'), 'Kettle Ridge Mechanical Ltd.', '100 Sample Street, Burnaby, BC V5A 0A0', '604-555-0100'),
  (tests.id('orgE'), 'Phoneless Plumbing Ltd.', '9 Side Rd, Surrey, BC V3T 1A1', null);

-- A frozen version that was sent before this change, with a scope that lists a type no line covers.
insert into public.sites (id, org_id, customer_id, name) values (tests.id('p0old:site'), tests.id('orgA'), tests.id('custA'), 'p0old');
insert into public.agreements (id, org_id, site_id, status) values (tests.id('p0old'), tests.id('orgA'), tests.id('p0old:site'), 'sent');
insert into public.agreement_versions (id, org_id, agreement_id, version_no, snapshot)
values (tests.id('p0old:v1'), tests.id('orgA'), tests.id('p0old'), 1,
        '{"schema": 2, "types": [{"code": "CHILLER", "name": "Chiller", "tasks": [], "assets": [{"unitNo": "CH-1", "typeModel": null, "location": null}]}], "takenAt": "2026-01-01T00:00:00+00:00"}');
