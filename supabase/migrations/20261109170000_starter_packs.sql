-- Plumbing and electrical starter packs (.specs/features/starter-packs/plan.md, doors 1 to 4).
-- Door 1: two registered packs, `plumbing` and `electrical`, with their trade phrases.
-- Door 2: a pack seeds only once `released_at` is set; the two new packs ship unreleased, so no org can receive them
-- until a practitioner has signed them off and a later migration sets their release. `hvac` is released here: its
-- catalog came from the owner's own proposal template.
-- Door 4: `private.pack_review_sheet(pack)` renders a pack for the reviewer, one row per task (door 3 is the saved query
-- `supabase/packs/sheet.sql`, which calls it).
-- Draft content, written by Claude and not yet reviewed by a practitioner: wording is generic and cites no standard,
-- interval or code; default months are a starting point. See .specs/features/starter-packs/types-draft.md.

-- Door 2: null means not released. No default, so a pack registered in a hurry cannot seed by accident.
alter table private.catalog_packs add column released_at timestamptz;
update private.catalog_packs set released_at = now() where pack = 'hvac';

-- Door 1.
insert into private.catalog_packs (pack, trade_context) values
  ('plumbing', 'plumbing'),
  ('electrical', 'electrical');

-- The 40 types: pack, code, name, default visit months, spellings. Three plumbing codes (BACKFLOW_PREVENTER,
-- PRESSURE_REGULATING_VALVE, EXPANSION_TANK) are also hvac codes on purpose; an org seeded with both keeps the checklist of
-- the pack it was seeded with first (AD-154: the seed skips any conflict).
insert into private.catalog_asset_types (pack, code, name, default_visit_months, synonyms) values
  ('plumbing', 'BACKFLOW_PREVENTER', 'Backflow preventer', '{10}', array['backflow', 'backflow device', 'backflow assembly', 'rpz', 'rpz assembly', 'double check valve', 'dcva']),
  ('plumbing', 'PRESSURE_REGULATING_VALVE', 'Pressure regulating valve', '{10}', array['prv', 'pressure reducing valve', 'water pressure regulator']),
  ('plumbing', 'EXPANSION_TANK', 'Expansion tank', '{10}', array['thermal expansion tank', 'potable expansion tank']),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 'Water heater (commercial)', '{4,10}', array['water heater', 'hot water heater', 'commercial water heater', 'hot water tank']),
  ('plumbing', 'TANKLESS_WATER_HEATER', 'Tankless water heater', '{10}', array['tankless', 'on demand water heater', 'instantaneous water heater']),
  ('plumbing', 'MIXING_VALVE', 'Thermostatic mixing valve', '{10}', array['mixing valve', 'tempering valve', 'tmv', 'anti scald valve']),
  ('plumbing', 'RECIRCULATION_PUMP', 'Recirculation pump', '{4,10}', array['recirc pump', 'recirculating pump', 'hot water recirculation pump', 'dhw recirculation pump']),
  ('plumbing', 'BOOSTER_PUMP', 'Domestic booster pump', '{4,10}', array['booster pump', 'water booster pump', 'domestic water booster', 'pressure booster pump']),
  ('plumbing', 'SUMP_PUMP', 'Sump pump', '{4,10}', array['sump', 'sump pit pump', 'sump pumps']),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 'Sewage ejector pump', '{4,10}', array['sewage ejector', 'ejector pump', 'sewage pump', 'lift station pump']),
  ('plumbing', 'GREASE_INTERCEPTOR', 'Grease interceptor', '{3,6,9,12}', array['grease trap', 'grease interceptor tank', 'gravity grease interceptor', 'grease separator']),
  ('plumbing', 'OIL_INTERCEPTOR', 'Sand and oil interceptor', '{4,10}', array['oil interceptor', 'oil water separator', 'sand interceptor', 'sand trap', 'oil separator']),
  ('plumbing', 'FLOOR_DRAIN', 'Floor drain and trap primer', '{4,10}', array['floor drain', 'floor drains', 'trap primer', 'drain trap']),
  ('plumbing', 'BACKWATER_VALVE', 'Backwater valve', '{4,10}', array['backwater', 'backwater valve assembly', 'sewer backflow valve', 'backup valve']),
  ('plumbing', 'ROOF_DRAIN', 'Roof drain', '{4,10}', array['roof drains', 'roof drain and leader', 'roof leader']),
  ('plumbing', 'WATER_SOFTENER', 'Water softener', '{4,10}', array['softener', 'water softening system', 'brine tank softener']),
  ('plumbing', 'WATER_FILTRATION', 'Water filtration system', '{4,10}', array['water filter', 'filtration system', 'ro system', 'reverse osmosis system', 'carbon filter']),
  ('plumbing', 'DRINKING_FOUNTAIN', 'Drinking fountain', '{4,10}', array['water fountain', 'bubbler', 'bottle filling station', 'water cooler']),
  ('plumbing', 'EYEWASH_STATION', 'Emergency eyewash and shower', '{10}', array['eyewash', 'eye wash station', 'emergency shower', 'safety shower', 'eyewash and shower']),
  ('plumbing', 'FLUSH_VALVE', 'Flush valve and fixture', '{4,10}', array['flush valve', 'flushometer', 'urinal', 'toilet']),
  ('electrical', 'SWITCHGEAR', 'Switchgear', '{10}', array['switch gear', 'main switchgear', 'medium voltage switchgear', 'lv switchgear']),
  ('electrical', 'SWITCHBOARD', 'Switchboard', '{10}', array['switch board', 'main switchboard', 'msb', 'main distribution board']),
  ('electrical', 'DISTRIBUTION_PANEL', 'Distribution panel', '{10}', array['distribution board', 'power distribution panel', 'dp', 'distribution panelboard']),
  ('electrical', 'BRANCH_PANEL', 'Branch circuit panel', '{10}', array['branch panel', 'breaker panel', 'panelboard', 'lighting panel', 'electrical panel']),
  ('electrical', 'MOTOR_CONTROL_CENTER', 'Motor control center', '{10}', array['mcc', 'motor control centre', 'motor control panel']),
  ('electrical', 'DRY_TRANSFORMER', 'Dry-type transformer', '{10}', array['transformer', 'dry type transformer', 'dry transformer', 'step down transformer']),
  ('electrical', 'DISCONNECT_SWITCH', 'Disconnect switch', '{10}', array['disconnect', 'safety switch', 'fused disconnect', 'service disconnect']),
  ('electrical', 'VFD', 'Variable frequency drive', '{10}', array['vsd', 'variable speed drive', 'inverter drive', 'ac drive']),
  ('electrical', 'GENERATOR', 'Standby generator', '{4,10}', array['generator set', 'genset', 'emergency generator', 'backup generator', 'diesel generator']),
  ('electrical', 'TRANSFER_SWITCH', 'Automatic transfer switch', '{10}', array['ats', 'transfer switch', 'auto transfer switch', 'generator transfer switch']),
  ('electrical', 'UPS', 'UPS (uninterruptible power supply)', '{4,10}', array['uninterruptible power supply', 'ups unit', 'battery backup']),
  ('electrical', 'BATTERY_SYSTEM', 'Battery system', '{4,10}', array['battery bank', 'battery cabinet', 'batteries', 'dc battery system']),
  ('electrical', 'EMERGENCY_LIGHTING', 'Emergency lighting unit', '{10}', array['emergency light', 'emergency lights', 'battery pack light', 'emergency lighting', 'bug eye light']),
  ('electrical', 'EXIT_SIGN', 'Exit sign', '{10}', array['exit light', 'exit signs', 'illuminated exit sign']),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 'Lighting control panel', '{10}', array['lighting controller', 'lighting control', 'lighting relay panel', 'relay panel']),
  ('electrical', 'SITE_LIGHTING', 'Site and parking lot lighting', '{4,10}', array['parking lot lighting', 'parking lot lights', 'pole light', 'pole lights', 'exterior lighting', 'site lights']),
  ('electrical', 'GFCI_DEVICE', 'Ground-fault protection device', '{10}', array['gfci', 'gfi', 'ground fault interrupter', 'ground fault receptacle', 'ground fault breaker']),
  ('electrical', 'SURGE_PROTECTOR', 'Surge protective device', '{10}', array['spd', 'surge suppressor', 'tvss', 'surge protection device', 'surge arrester']),
  ('electrical', 'EV_CHARGER', 'EV charger', '{4,10}', array['ev charging station', 'electric vehicle charger', 'evse', 'charging station', 'ev charge point']),
  ('electrical', 'GROUNDING_SYSTEM', 'Grounding and lightning protection', '{10}', array['grounding', 'ground system', 'lightning protection', 'lightning rod', 'earthing system', 'bonding']);

insert into private.catalog_asset_type_tasks (pack, code, position, description) values
  ('plumbing', 'BACKFLOW_PREVENTER', 1, 'Visual check of the assembly, shutoff valves and test cocks for leaks'),
  ('plumbing', 'BACKFLOW_PREVENTER', 2, 'Test the assembly with a calibrated gauge and record the readings'),
  ('plumbing', 'BACKFLOW_PREVENTER', 3, 'Check that the relief port is clear and the air gap is intact'),
  ('plumbing', 'BACKFLOW_PREVENTER', 4, 'Repair or replace worn parts if the assembly fails the test, then retest'),
  ('plumbing', 'BACKFLOW_PREVENTER', 5, 'Tag the assembly and file the test report where the water authority requires it'),
  ('plumbing', 'PRESSURE_REGULATING_VALVE', 1, 'Check inlet and outlet pressure against the set point'),
  ('plumbing', 'PRESSURE_REGULATING_VALVE', 2, 'Visual check for leaks, corrosion and pressure creep'),
  ('plumbing', 'PRESSURE_REGULATING_VALVE', 3, 'Check the strainer and clean it if fitted'),
  ('plumbing', 'PRESSURE_REGULATING_VALVE', 4, 'Adjust the set point if the outlet pressure has drifted'),
  ('plumbing', 'EXPANSION_TANK', 1, 'Visual check for leak and corrosion'),
  ('plumbing', 'EXPANSION_TANK', 2, 'Check the air-side pressure with the tank isolated and adjust it to the system pressure'),
  ('plumbing', 'EXPANSION_TANK', 3, 'Check the tank for waterlogging'),
  ('plumbing', 'EXPANSION_TANK', 4, 'Check the supports and the connection'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 1, 'Visual check of the tank, fittings and relief valve discharge for leaks'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 2, 'Test the temperature and pressure relief valve'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 3, 'Flush sediment from the tank through the drain'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 4, 'Check the anode rod and replace it if depleted'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 5, 'Check the burners or elements and the venting or electrical connections'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 6, 'Check the thermostat setting against the outlet temperature'),
  ('plumbing', 'TANKLESS_WATER_HEATER', 1, 'Visual check for leaks and read any error codes'),
  ('plumbing', 'TANKLESS_WATER_HEATER', 2, 'Clean the inlet filter'),
  ('plumbing', 'TANKLESS_WATER_HEATER', 3, 'Flush the heat exchanger for scale where the water is hard'),
  ('plumbing', 'TANKLESS_WATER_HEATER', 4, 'Check the venting and the condensate drain'),
  ('plumbing', 'TANKLESS_WATER_HEATER', 5, 'Check the outlet temperature against the set point'),
  ('plumbing', 'MIXING_VALVE', 1, 'Measure the mixed outlet temperature and compare it with the set point'),
  ('plumbing', 'MIXING_VALVE', 2, 'Cut the cold supply and check that the hot flow shuts off'),
  ('plumbing', 'MIXING_VALVE', 3, 'Clean or replace the check stops and the strainer if fitted'),
  ('plumbing', 'MIXING_VALVE', 4, 'Record the readings and adjust or replace the valve if it is out of range'),
  ('plumbing', 'RECIRCULATION_PUMP', 1, 'Check that the pump runs and listen for noise and vibration'),
  ('plumbing', 'RECIRCULATION_PUMP', 2, 'Visual check for leaks at the seals and unions'),
  ('plumbing', 'RECIRCULATION_PUMP', 3, 'Check the motor amperage against the nameplate'),
  ('plumbing', 'RECIRCULATION_PUMP', 4, 'Check the check valve and the isolation valves'),
  ('plumbing', 'RECIRCULATION_PUMP', 5, 'Check the timer or aquastat that controls the pump'),
  ('plumbing', 'BOOSTER_PUMP', 1, 'Check the start, run and stop sequence'),
  ('plumbing', 'BOOSTER_PUMP', 2, 'Check suction and discharge pressure against the set points'),
  ('plumbing', 'BOOSTER_PUMP', 3, 'Check the pressure tank air charge'),
  ('plumbing', 'BOOSTER_PUMP', 4, 'Visual check for leaks at the seals and fittings'),
  ('plumbing', 'BOOSTER_PUMP', 5, 'Lubricate the bearings if applicable and check the motor amperage'),
  ('plumbing', 'BOOSTER_PUMP', 6, 'Check the controller and its alarms'),
  ('plumbing', 'SUMP_PUMP', 1, 'Clear debris from the pit'),
  ('plumbing', 'SUMP_PUMP', 2, 'Test the float switch by raising the water level'),
  ('plumbing', 'SUMP_PUMP', 3, 'Run the pump and check the discharge flow'),
  ('plumbing', 'SUMP_PUMP', 4, 'Check the check valve and the discharge piping'),
  ('plumbing', 'SUMP_PUMP', 5, 'Test the high-water alarm if fitted'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 1, 'Check the pit and the cover seal for leaks and odour'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 2, 'Clear debris and solids from the pit'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 3, 'Test the floats and the pump cycle'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 4, 'Check the check valve and the isolation valve'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 5, 'Check the motor amperage against the nameplate'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 6, 'Test the high-water alarm'),
  ('plumbing', 'GREASE_INTERCEPTOR', 1, 'Measure the depth of grease and solids'),
  ('plumbing', 'GREASE_INTERCEPTOR', 2, 'Arrange removal of the contents when the depth calls for it'),
  ('plumbing', 'GREASE_INTERCEPTOR', 3, 'Check the baffles, inlet and outlet for damage and blockage'),
  ('plumbing', 'GREASE_INTERCEPTOR', 4, 'Check the cover and its seal'),
  ('plumbing', 'GREASE_INTERCEPTOR', 5, 'Record the depth and the date in the service log'),
  ('plumbing', 'OIL_INTERCEPTOR', 1, 'Measure the depth of oil and sediment'),
  ('plumbing', 'OIL_INTERCEPTOR', 2, 'Arrange removal of oil and sediment when the depth calls for it'),
  ('plumbing', 'OIL_INTERCEPTOR', 3, 'Check the baffles, inlet and outlet for damage and blockage'),
  ('plumbing', 'OIL_INTERCEPTOR', 4, 'Check the cover, the vent and the alarm if fitted'),
  ('plumbing', 'FLOOR_DRAIN', 1, 'Clear the strainer and the trap of debris'),
  ('plumbing', 'FLOOR_DRAIN', 2, 'Pour water into the trap and check that it drains freely'),
  ('plumbing', 'FLOOR_DRAIN', 3, 'Check that the trap seal holds water'),
  ('plumbing', 'FLOOR_DRAIN', 4, 'Check the trap primer operation if fitted'),
  ('plumbing', 'BACKWATER_VALVE', 1, 'Open the access cover and clear debris from the valve'),
  ('plumbing', 'BACKWATER_VALVE', 2, 'Check that the flap moves freely and seats'),
  ('plumbing', 'BACKWATER_VALVE', 3, 'Check the cover seal and the access'),
  ('plumbing', 'BACKWATER_VALVE', 4, 'Visual check for leaks'),
  ('plumbing', 'ROOF_DRAIN', 1, 'Clear debris and leaves from the dome and the sump'),
  ('plumbing', 'ROOF_DRAIN', 2, 'Flush the drain with water and check that it runs freely'),
  ('plumbing', 'ROOF_DRAIN', 3, 'Check the clamping ring, the dome and the flashing for damage'),
  ('plumbing', 'ROOF_DRAIN', 4, 'Check the overflow drains where fitted'),
  ('plumbing', 'WATER_SOFTENER', 1, 'Check the salt level and the brine tank'),
  ('plumbing', 'WATER_SOFTENER', 2, 'Test the outlet hardness'),
  ('plumbing', 'WATER_SOFTENER', 3, 'Check the controller settings and run a regeneration'),
  ('plumbing', 'WATER_SOFTENER', 4, 'Check the drain line and the bypass valve'),
  ('plumbing', 'WATER_SOFTENER', 5, 'Visual check for leaks'),
  ('plumbing', 'WATER_FILTRATION', 1, 'Check the pressure drop across the filter'),
  ('plumbing', 'WATER_FILTRATION', 2, 'Replace the filter cartridges or media as scheduled'),
  ('plumbing', 'WATER_FILTRATION', 3, 'Visual check for leaks at the housings and fittings'),
  ('plumbing', 'WATER_FILTRATION', 4, 'Check the controller and the drain'),
  ('plumbing', 'DRINKING_FOUNTAIN', 1, 'Check the water flow and the stream height'),
  ('plumbing', 'DRINKING_FOUNTAIN', 2, 'Clean the bubbler and the strainer'),
  ('plumbing', 'DRINKING_FOUNTAIN', 3, 'Replace the filter if fitted'),
  ('plumbing', 'DRINKING_FOUNTAIN', 4, 'Check the drain, the trap and the supply connection for leaks'),
  ('plumbing', 'DRINKING_FOUNTAIN', 5, 'Check that the water is chilled if the unit cools'),
  ('plumbing', 'EYEWASH_STATION', 1, 'Activate the unit and check that it flushes both eyes with a steady flow'),
  ('plumbing', 'EYEWASH_STATION', 2, 'Activate the shower head and check the flow'),
  ('plumbing', 'EYEWASH_STATION', 3, 'Flush the line until the water runs clear'),
  ('plumbing', 'EYEWASH_STATION', 4, 'Check that the valve opens quickly and stays open without a hand on it'),
  ('plumbing', 'EYEWASH_STATION', 5, 'Check the dust caps, the signage and the clear path to the unit'),
  ('plumbing', 'EYEWASH_STATION', 6, 'Check the tepid water supply if fitted and complete the inspection tag'),
  ('plumbing', 'FLUSH_VALVE', 1, 'Operate each valve and check the flush and the refill'),
  ('plumbing', 'FLUSH_VALVE', 2, 'Check for leaks and running fixtures'),
  ('plumbing', 'FLUSH_VALVE', 3, 'Replace worn diaphragms and seals as needed'),
  ('plumbing', 'FLUSH_VALVE', 4, 'Check the stops and the handle or sensor'),
  ('electrical', 'SWITCHGEAR', 1, 'Visual check of the enclosure, doors, labels and room condition'),
  ('electrical', 'SWITCHGEAR', 2, 'Infrared scan of the connections under load'),
  ('electrical', 'SWITCHGEAR', 3, 'Clean the interior and check connections where the equipment can be de-energized'),
  ('electrical', 'SWITCHGEAR', 4, 'Exercise the breakers and check the operating mechanisms'),
  ('electrical', 'SWITCHGEAR', 5, 'Check the protective relay settings against the single-line drawing'),
  ('electrical', 'SWITCHGEAR', 6, 'Record the findings and any deficiency'),
  ('electrical', 'SWITCHBOARD', 1, 'Visual check of the enclosure, labels and working clearances'),
  ('electrical', 'SWITCHBOARD', 2, 'Infrared scan of the connections under load'),
  ('electrical', 'SWITCHBOARD', 3, 'Check for signs of overheating, corrosion and moisture'),
  ('electrical', 'SWITCHBOARD', 4, 'Tighten the connections where the equipment can be de-energized'),
  ('electrical', 'SWITCHBOARD', 5, 'Exercise the main and feeder breakers'),
  ('electrical', 'SWITCHBOARD', 6, 'Record the findings and any deficiency'),
  ('electrical', 'DISTRIBUTION_PANEL', 1, 'Visual check of the enclosure, labels and working clearances'),
  ('electrical', 'DISTRIBUTION_PANEL', 2, 'Infrared scan of the connections under load'),
  ('electrical', 'DISTRIBUTION_PANEL', 3, 'Tighten the connections where the panel can be de-energized'),
  ('electrical', 'DISTRIBUTION_PANEL', 4, 'Check the breakers for damage and heat marks'),
  ('electrical', 'DISTRIBUTION_PANEL', 5, 'Record the load on each phase and any deficiency'),
  ('electrical', 'BRANCH_PANEL', 1, 'Visual check of the cover, the labels and the working clearance'),
  ('electrical', 'BRANCH_PANEL', 2, 'Infrared scan of the connections under load'),
  ('electrical', 'BRANCH_PANEL', 3, 'Check the circuit directory against the breakers'),
  ('electrical', 'BRANCH_PANEL', 4, 'Check for double-tapped, loose or heat-marked breakers'),
  ('electrical', 'BRANCH_PANEL', 5, 'Record any deficiency'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 1, 'Visual check of the enclosure, the buckets and the labels'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 2, 'Infrared scan of the connections under load'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 3, 'Check the starters and contactors for wear and pitting'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 4, 'Clean the interior and tighten the connections where it can be de-energized'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 5, 'Check the overload settings against the motor nameplates'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 6, 'Record the findings and any deficiency'),
  ('electrical', 'DRY_TRANSFORMER', 1, 'Visual check for dust, damage and blocked ventilation'),
  ('electrical', 'DRY_TRANSFORMER', 2, 'Infrared scan of the connections and the windings under load'),
  ('electrical', 'DRY_TRANSFORMER', 3, 'Tighten the connections where the unit can be de-energized'),
  ('electrical', 'DRY_TRANSFORMER', 4, 'Check the grounding and the enclosure'),
  ('electrical', 'DRY_TRANSFORMER', 5, 'Listen for unusual noise and record the load'),
  ('electrical', 'DISCONNECT_SWITCH', 1, 'Visual check of the enclosure, the labels and the handle'),
  ('electrical', 'DISCONNECT_SWITCH', 2, 'Operate the handle and check the mechanism'),
  ('electrical', 'DISCONNECT_SWITCH', 3, 'Check the fuses against the rating on the label'),
  ('electrical', 'DISCONNECT_SWITCH', 4, 'Infrared scan of the connections under load'),
  ('electrical', 'DISCONNECT_SWITCH', 5, 'Check the lockout provision'),
  ('electrical', 'VFD', 1, 'Read the display and any fault history'),
  ('electrical', 'VFD', 2, 'Clean the filters and the heat sink vents'),
  ('electrical', 'VFD', 3, 'Check the cooling fan'),
  ('electrical', 'VFD', 4, 'Check the power and control connections'),
  ('electrical', 'VFD', 5, 'Record the motor current and the parameters'),
  ('electrical', 'GENERATOR', 1, 'Check the oil, coolant and fuel levels'),
  ('electrical', 'GENERATOR', 2, 'Check the battery, the charger and the block heater'),
  ('electrical', 'GENERATOR', 3, 'Visual check of the belts, hoses and fittings for leaks and wear'),
  ('electrical', 'GENERATOR', 4, 'Start the unit, run it under load and record voltage, frequency and oil pressure'),
  ('electrical', 'GENERATOR', 5, 'Check the exhaust, the louvers and the enclosure'),
  ('electrical', 'GENERATOR', 6, 'Record the run hours and any deficiency'),
  ('electrical', 'TRANSFER_SWITCH', 1, 'Visual check of the enclosure, the labels and the contacts'),
  ('electrical', 'TRANSFER_SWITCH', 2, 'Infrared scan of the terminals under load'),
  ('electrical', 'TRANSFER_SWITCH', 3, 'Run a transfer test and return, and record the transfer times'),
  ('electrical', 'TRANSFER_SWITCH', 4, 'Check the control settings and the timers'),
  ('electrical', 'TRANSFER_SWITCH', 5, 'Clean and lubricate the mechanism where applicable'),
  ('electrical', 'UPS', 1, 'Read the display and the alarm log'),
  ('electrical', 'UPS', 2, 'Check the load and the runtime shown against the last visit'),
  ('electrical', 'UPS', 3, 'Check the batteries for leaks, swelling and heat'),
  ('electrical', 'UPS', 4, 'Test the transfer to battery and back'),
  ('electrical', 'UPS', 5, 'Clean the air filters and check the fans'),
  ('electrical', 'BATTERY_SYSTEM', 1, 'Visual check for leaks, swelling and corrosion'),
  ('electrical', 'BATTERY_SYSTEM', 2, 'Measure the voltage of each string and unit'),
  ('electrical', 'BATTERY_SYSTEM', 3, 'Check the terminal connections'),
  ('electrical', 'BATTERY_SYSTEM', 4, 'Check the room temperature and the ventilation'),
  ('electrical', 'BATTERY_SYSTEM', 5, 'Record the readings and compare them with the last visit'),
  ('electrical', 'EMERGENCY_LIGHTING', 1, 'Check the charge indicator'),
  ('electrical', 'EMERGENCY_LIGHTING', 2, 'Run a function test on battery power'),
  ('electrical', 'EMERGENCY_LIGHTING', 3, 'Run the extended battery duration test where it is due'),
  ('electrical', 'EMERGENCY_LIGHTING', 4, 'Replace failed lamps and batteries'),
  ('electrical', 'EMERGENCY_LIGHTING', 5, 'Record the results in the log'),
  ('electrical', 'EXIT_SIGN', 1, 'Check that the sign is lit and readable'),
  ('electrical', 'EXIT_SIGN', 2, 'Test the battery backup where fitted'),
  ('electrical', 'EXIT_SIGN', 3, 'Replace failed lamps and batteries'),
  ('electrical', 'EXIT_SIGN', 4, 'Check the mounting and that nothing blocks the sign'),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 1, 'Check that the relays operate'),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 2, 'Check the schedules and the time clock'),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 3, 'Check the manual overrides'),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 4, 'Check the photocell and the sensors'),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 5, 'Record any deficiency'),
  ('electrical', 'SITE_LIGHTING', 1, 'Walk the site at night and note the lamps that are out'),
  ('electrical', 'SITE_LIGHTING', 2, 'Check the poles, the bases and the handhole covers for damage'),
  ('electrical', 'SITE_LIGHTING', 3, 'Check the photocells and the timers'),
  ('electrical', 'SITE_LIGHTING', 4, 'Check the fixtures and the lenses'),
  ('electrical', 'SITE_LIGHTING', 5, 'Record the lamps and fixtures that need repair'),
  ('electrical', 'GFCI_DEVICE', 1, 'Press the test button and check that the device trips'),
  ('electrical', 'GFCI_DEVICE', 2, 'Reset the device and check that power returns'),
  ('electrical', 'GFCI_DEVICE', 3, 'Replace a device that fails the test'),
  ('electrical', 'GFCI_DEVICE', 4, 'Record the devices tested'),
  ('electrical', 'SURGE_PROTECTOR', 1, 'Read the status indicators'),
  ('electrical', 'SURGE_PROTECTOR', 2, 'Check the connections and the leads'),
  ('electrical', 'SURGE_PROTECTOR', 3, 'Replace a module that shows end of life'),
  ('electrical', 'SURGE_PROTECTOR', 4, 'Record the status of each device'),
  ('electrical', 'EV_CHARGER', 1, 'Visual check of the cable, the connector and the enclosure for damage'),
  ('electrical', 'EV_CHARGER', 2, 'Check the display and the network status'),
  ('electrical', 'EV_CHARGER', 3, 'Run a test charge session'),
  ('electrical', 'EV_CHARGER', 4, 'Test the ground-fault protection of the unit'),
  ('electrical', 'EV_CHARGER', 5, 'Clean the unit and check the mounting'),
  ('electrical', 'GROUNDING_SYSTEM', 1, 'Visual check of the grounding conductors and their connections'),
  ('electrical', 'GROUNDING_SYSTEM', 2, 'Check the bonding at the main service'),
  ('electrical', 'GROUNDING_SYSTEM', 3, 'Check the air terminals and the down conductors for damage'),
  ('electrical', 'GROUNDING_SYSTEM', 4, 'Measure the ground resistance where the contract asks for it'),
  ('electrical', 'GROUNDING_SYSTEM', 5, 'Record the findings and any deficiency');

-- As 20261109154806_synonyms_as_data.sql, and a pack that is not released raises 55000 before anything is written.
create or replace function private.seed_org_catalog(p_org uuid, p_pack text default 'hvac') returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
  v_phrase text;
begin
  if not exists (select 1 from private.catalog_asset_types where pack = p_pack) then
    raise exception 'no catalog pack named %', p_pack using errcode = '22023';
  end if;
  if not exists (select 1 from private.catalog_packs where pack = p_pack and released_at is not null) then
    raise exception 'catalog pack % is not released', p_pack using errcode = '55000';
  end if;
  with inserted as (
    insert into public.asset_types (org_id, code, name, default_visit_months, pack, synonyms)
    select p_org, c.code, c.name, c.default_visit_months, c.pack, c.synonyms
    from private.catalog_asset_types c
    where c.pack = p_pack
    on conflict do nothing
    returning id, code
  ),
  tasks as (
    insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
    select p_org, i.id, t.position, t.description, t.visit_months
    from inserted i
    join private.catalog_asset_type_tasks t on t.pack = p_pack and t.code = i.code
  )
  select count(*) into n from inserted;

  select p.trade_context into v_phrase from private.catalog_packs p where p.pack = p_pack;
  update public.org_settings s
  set trade_context = case
    when s.trade_context is null then v_phrase
    when v_phrase = any (string_to_array(s.trade_context, ', ')) then s.trade_context
    else s.trade_context || ', ' || v_phrase
  end
  where s.org_id = p_org;
  return n;
end $$;

-- Door 4: the reviewer's sheet. One row per task, in code then position order; no row for an unregistered pack.
create function private.pack_review_sheet(p_pack text)
returns table (pack text, code text, name text, default_visit_months smallint[], synonyms text[], task_position integer, task text)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.pack, c.code, c.name, c.default_visit_months, c.synonyms, t.position, t.description
  from private.catalog_asset_types c
  join private.catalog_asset_type_tasks t on t.pack = c.pack and t.code = c.code
  where c.pack = p_pack
  order by c.code, t.position
$$;

revoke execute on function private.pack_review_sheet(text) from public, anon, authenticated;
