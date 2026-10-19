-- Demo data: a fictitious contractor, Kettle Ridge Mechanical Ltd. (.specs/features/catalog-seed/plan.md, door 5).
-- One transaction, safe to run again: every row has a fixed id (door 4) and inserts skip rows that exist.
-- Customer names match web/lib/sample-pipeline.ts. Emails use example.com and phones the 555-01xx fiction range.
-- The org has no members and no agreements: the auth item attaches a member, the domain layer writes agreements.
begin;

insert into public.orgs (id, name)
values ('00000000-0000-4000-8000-00000000de30', 'Kettle Ridge Mechanical Ltd.')
on conflict (id) do nothing;

insert into public.org_settings (org_id, legal_name, address, phone, accent_color, repair_discount_pct, cpi_cap_pct,
                                 cancellation_notice_days, payment_days, governing_province, tax_note)
values ('00000000-0000-4000-8000-00000000de30', 'Kettle Ridge Mechanical Ltd.',
        '100 Sample Street, Burnaby, BC V5A 0A0', '604-555-0100', '#1f6f8b', 10, 5, 30, 30, 'BC',
        'Prices exclude applicable taxes (GST and PST).')
on conflict (org_id) do nothing;

select private.seed_org_catalog('00000000-0000-4000-8000-00000000de30');

drop table if exists pg_temp.demo_customers;
create temporary table demo_customers (n integer, customer text, contact text, email text, phone text,
                                       site text, address text) on commit drop;
insert into demo_customers values
  (1, 'Harbourview Towers Strata', 'Dana Whitfield', 'dana.whitfield@example.com', '604-555-0101', 'Harbourview Towers', '2150 Harbour Lane, North Vancouver, BC'),
  (2, 'Pinecrest Office Park', 'Marcus Ilunga', 'marcus.ilunga@example.com', '604-555-0102', 'Pinecrest Office Park, Building A', '480 Pinecrest Way, Burnaby, BC'),
  (3, 'Lakeshore Brewing Co.', 'Priya Natarajan', 'priya.natarajan@example.com', '604-555-0103', 'Lakeshore Brewery and Taproom', '77 Lakeshore Drive, Port Moody, BC'),
  (4, 'Northgate Self Storage', 'Owen Calloway', 'owen.calloway@example.com', '604-555-0104', 'Northgate Self Storage', '9100 Northgate Road, Surrey, BC'),
  (5, 'Juniper Medical Clinic', 'Elena Soto', 'elena.soto@example.com', '604-555-0105', 'Juniper Medical Clinic', '3305 Juniper Street, Richmond, BC'),
  (6, 'Copperleaf Seniors Residence', 'Graham Lindqvist', 'graham.lindqvist@example.com', '604-555-0106', 'Copperleaf Residence', '1200 Copperleaf Crescent, Coquitlam, BC'),
  (7, 'Tidewater Hotel', 'Aisha Rahman', 'aisha.rahman@example.com', '604-555-0107', 'Tidewater Hotel', '15 Tidewater Quay, Vancouver, BC'),
  (8, 'Glacier Valley Cold Storage', 'Tomas Reyes', 'tomas.reyes@example.com', '604-555-0108', 'Glacier Valley Warehouse 2', '5600 Valley Industrial Way, Langley, BC'),
  (9, 'Brookhaven Community Centre', 'Hannah Okafor', 'hannah.okafor@example.com', '604-555-0109', 'Brookhaven Community Centre', '820 Brookhaven Avenue, New Westminster, BC'),
  (10, 'Ridgeline Retail Plaza', 'Kevin Tran', 'kevin.tran@example.com', '604-555-0110', 'Ridgeline Retail Plaza', '2400 Ridgeline Boulevard, Maple Ridge, BC'),
  (11, 'Saltmarsh Bakery', 'Claire Dubois', 'claire.dubois@example.com', '604-555-0111', 'Saltmarsh Bakery', '41 Saltmarsh Lane, Delta, BC'),
  (12, 'Fernwood Dental', 'Samuel Park', 'samuel.park@example.com', '604-555-0112', 'Fernwood Dental', '1880 Fernwood Road, West Vancouver, BC');

insert into public.customers (id, org_id, name)
select md5('demo:customer:' || n)::uuid, '00000000-0000-4000-8000-00000000de30', customer
from demo_customers
on conflict (id) do nothing;

insert into public.contacts (id, org_id, customer_id, name, email, phone)
select md5('demo:contact:' || n)::uuid, '00000000-0000-4000-8000-00000000de30', md5('demo:customer:' || n)::uuid,
       contact, email, phone
from demo_customers
on conflict (id) do nothing;

insert into public.sites (id, org_id, customer_id, site_contact_id, name, address)
select md5('demo:site:' || n)::uuid, '00000000-0000-4000-8000-00000000de30', md5('demo:customer:' || n)::uuid,
       md5('demo:contact:' || n)::uuid, site, address
from demo_customers
on conflict (id) do nothing;

insert into public.assets (id, org_id, site_id, asset_type_id, unit_no, type_model, location, source)
select md5('demo:asset:' || a.site || ':' || a.unit_no)::uuid, '00000000-0000-4000-8000-00000000de30',
       md5('demo:site:' || a.site)::uuid, t.id, a.unit_no, a.type_model, a.location, 'manual'
from (values
  (1, 'B-1', 'BOILER', 'Condensing boiler, 1,000 MBH', 'Mechanical room P1'),
  (1, 'B-2', 'BOILER', 'Condensing boiler, 1,000 MBH', 'Mechanical room P1'),
  (1, 'ET-1', 'EXPANSION_TANK', 'Bladder expansion tank, 80 gal', 'Mechanical room P1'),
  (1, 'P-1', 'PUMP', 'Inline circulator, 3 hp', 'Mechanical room P1'),
  (1, 'P-2', 'PUMP', 'Inline circulator, 3 hp', 'Mechanical room P1'),
  (1, 'MUA-1', 'MUA', 'Gas-fired make-up air, 4,000 cfm', 'Roof, north side'),
  (1, 'EF-1', 'EXHAUST_FAN', 'Garage exhaust fan, 2 hp', 'Parkade level P2'),
  (2, 'RTU-1', 'RTU', 'Packaged gas/electric, 7.5 ton', 'Roof, east side'),
  (2, 'RTU-2', 'RTU', 'Packaged gas/electric, 7.5 ton', 'Roof, east side'),
  (2, 'RTU-3', 'RTU', 'Packaged gas/electric, 10 ton', 'Roof, west side'),
  (2, 'RTU-4', 'RTU', 'Packaged gas/electric, 5 ton', 'Roof, west side'),
  (2, 'EF-1', 'EXHAUST_FAN', 'Washroom exhaust fan, 1/2 hp', 'Roof, centre'),
  (2, 'BFP-1', 'BACKFLOW_PREVENTER', 'Double check valve, 2 in', 'Water entry room, ground floor'),
  (3, 'WIC-1', 'WALK_IN_COOLER', 'Walk-in cooler, 8 x 10 ft', 'Cellar, behind brewhouse'),
  (3, 'RTU-1', 'RTU', 'Packaged gas/electric, 6 ton', 'Roof above taproom'),
  (3, 'MUA-1', 'MUA', 'Gas-fired make-up air, 3,000 cfm', 'Roof above kitchen'),
  (3, 'BFP-1', 'BACKFLOW_PREVENTER', 'Reduced pressure assembly, 1 1/2 in', 'Brewhouse, east wall'),
  (4, 'RTU-1', 'RTU', 'Packaged gas/electric, 4 ton', 'Roof above office'),
  (4, 'UH-1', 'UNIT_HEATER_GAS', 'Gas unit heater, 100 MBH', 'Building B, ceiling at door 1'),
  (4, 'UH-2', 'UNIT_HEATER_GAS', 'Gas unit heater, 100 MBH', 'Building B, ceiling at door 6'),
  (5, 'RTU-1', 'RTU', 'Packaged gas/electric, 8.5 ton', 'Roof, south side'),
  (5, 'ERV-1', 'ERV', 'Energy recovery ventilator, 1,200 cfm', 'Ceiling space above reception'),
  (5, 'DS-1', 'DUCTLESS_SPLIT', 'Ductless split, 18,000 BTU', 'Server closet, room 104'),
  (5, 'HWT-1', 'HWT_HIGH_EFFICIENCY', 'Condensing water heater, 100 gal', 'Janitor room'),
  (6, 'B-1', 'BOILER', 'Condensing boiler, 750 MBH', 'Boiler room, basement'),
  (6, 'HRV-1', 'HRV', 'Heat recovery ventilator, 600 cfm', 'Fan room, level 4'),
  (6, 'FC-1', 'FAN_COIL', 'Vertical fan coil, 1,200 cfm', 'Dining room ceiling'),
  (6, 'FC-2', 'FAN_COIL', 'Vertical fan coil, 1,200 cfm', 'Lounge ceiling'),
  (6, 'HWT-1', 'HWT_MID_EFFICIENCY', 'Commercial water heater, 100 gal', 'Boiler room, basement'),
  (6, 'BFP-1', 'BACKFLOW_PREVENTER', 'Double check valve, 3 in', 'Water entry room, basement'),
  (7, 'CH-1', 'CHILLER', 'Air-cooled chiller, 120 ton', 'Roof, mechanical yard'),
  (7, 'CT-1', 'COOLING_TOWER', 'Induced-draft cooling tower, 150 ton', 'Roof, mechanical yard'),
  (7, 'AHU-1', 'AHU', 'Air handling unit, 12,000 cfm', 'Penthouse fan room'),
  (7, 'P-1', 'PUMP', 'Base-mounted pump, 10 hp', 'Mechanical room, basement'),
  (7, 'B-1', 'BOILER', 'Fire-tube boiler, 2,000 MBH', 'Mechanical room, basement'),
  (7, 'MUA-1', 'MUA', 'Gas-fired make-up air, 6,000 cfm', 'Roof above kitchen'),
  (7, 'ICE-1', 'ICE_MACHINE', 'Ice machine, 500 lb/day', 'Kitchen, back of house'),
  (7, 'SSF-1', 'SIDE_STREAM_FILTER', 'Side stream filter, 50 gpm', 'Roof, mechanical yard'),
  (8, 'WIF-1', 'WALK_IN_FREEZER', 'Walk-in freezer, 20 x 30 ft', 'Warehouse, bay 1'),
  (8, 'WIF-2', 'WALK_IN_FREEZER', 'Walk-in freezer, 20 x 30 ft', 'Warehouse, bay 2'),
  (8, 'WIC-1', 'WALK_IN_COOLER', 'Walk-in cooler, 12 x 20 ft', 'Warehouse, bay 3'),
  (8, 'UH-1', 'UNIT_HEATER_ELECTRIC', 'Electric unit heater, 10 kW', 'Loading dock'),
  (9, 'AHU-1', 'AHU', 'Air handling unit, 8,000 cfm', 'Mechanical mezzanine'),
  (9, 'B-1', 'BOILER', 'Condensing boiler, 1,500 MBH', 'Boiler room'),
  (9, 'ERV-1', 'ERV', 'Energy recovery ventilator, 2,500 cfm', 'Mechanical mezzanine'),
  (9, 'CO-1', 'CO_SENSOR', 'CO sensor, wall mount', 'Parkade entrance'),
  (9, 'HP-1', 'WSHP', 'Water source heat pump, 3 ton', 'Ceiling above multipurpose room'),
  (10, 'RTU-1', 'RTU', 'Packaged gas/electric, 12.5 ton', 'Roof above unit 101'),
  (10, 'RTU-2', 'RTU', 'Packaged gas/electric, 12.5 ton', 'Roof above unit 105'),
  (10, 'RTU-3', 'RTU', 'Packaged gas/electric, 7.5 ton', 'Roof above unit 110'),
  (10, 'CC-1', 'CASE_COOLER', 'Reach-in display cooler, 3 door', 'Unit 103, sales floor'),
  (10, 'CF-1', 'CASE_FREEZER', 'Reach-in display freezer, 2 door', 'Unit 103, sales floor'),
  (11, 'MUA-1', 'MUA', 'Gas-fired make-up air, 2,500 cfm', 'Roof above bakery'),
  (11, 'EF-1', 'EXHAUST_FAN', 'Oven hood exhaust fan, 1 hp', 'Roof above bakery'),
  (12, 'F-1', 'FURNACE', 'High-efficiency furnace, 80 MBH', 'Utility room'),
  (12, 'HRV-1', 'HRV', 'Heat recovery ventilator, 250 cfm', 'Utility room'),
  (12, 'DS-1', 'DUCTLESS_SPLIT', 'Ductless split, 12,000 BTU', 'Sterilization room')
) as a(site, unit_no, code, type_model, location)
join public.asset_types t on t.org_id = '00000000-0000-4000-8000-00000000de30' and t.code = a.code
on conflict (id) do nothing;

commit;
