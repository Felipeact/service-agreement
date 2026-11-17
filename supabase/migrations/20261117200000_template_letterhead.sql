-- A template's letterhead can be edited: doc may carry an optional "letterhead" = { logo, name, address, phone (booleans),
-- logoSize small|medium|large, align left|center }. A doc without it draws the letterhead every document drew before.
-- private.layout_problem keeps its name and signature (save_agreement_template and save_contract_template call it by name):
-- the existing check moves to layout_problem_core, and the wrapper validates the letterhead, then hands the rest to the core.
-- Existing template versions are never rewritten. NOT applied to the hosted project: applying it needs the owner's go-ahead.
alter function private.layout_problem(jsonb, jsonb, text[], text[]) rename to layout_problem_core;

create function private.layout_problem(p_doc jsonb, p_layout jsonb, p_sections text[], p_once text[])
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_lh jsonb;
begin
  if jsonb_typeof(p_doc) = 'object' and p_doc ? 'letterhead' then
    v_lh := p_doc -> 'letterhead';
    if not coalesce(private.jsonb_keys_within(v_lh, array['logo', 'name', 'address', 'phone', 'logoSize', 'align'], '{}'), false) then
      return 'letterhead must be { logo, name, address, phone, logoSize, align }';
    end if;
    if jsonb_typeof(v_lh -> 'logo') is distinct from 'boolean'
       or jsonb_typeof(v_lh -> 'name') is distinct from 'boolean'
       or jsonb_typeof(v_lh -> 'address') is distinct from 'boolean'
       or jsonb_typeof(v_lh -> 'phone') is distinct from 'boolean' then
      return 'letterhead logo, name, address and phone must be true or false';
    end if;
    if v_lh -> 'logoSize' not in ('"small"'::jsonb, '"medium"'::jsonb, '"large"'::jsonb) then
      return 'letterhead logoSize must be small, medium or large';
    end if;
    if v_lh -> 'align' not in ('"left"'::jsonb, '"center"'::jsonb) then
      return 'letterhead align must be left or center';
    end if;
    p_doc := p_doc - 'letterhead';
  end if;
  return private.layout_problem_core(p_doc, p_layout, p_sections, p_once);
end $$;

revoke execute on function private.layout_problem(jsonb, jsonb, text[], text[]) from public, anon, authenticated;
revoke execute on function private.layout_problem_core(jsonb, jsonb, text[], text[]) from public, anon, authenticated;
