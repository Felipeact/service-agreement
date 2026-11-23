-- A template can be designed (rich template editor, slice 1). Three additions, each optional, so a body that has none of them is
-- stored and drawn exactly as before:
--   doc.theme  = { accent: blue|teal|amber|violet|rose|slate, font: sans|serif }  (either key alone is fine)
--   a block may carry style = { align: left|center|right, bold: boolean, italic: boolean }
--   a layout item may be a table = { kind: 'table', header: boolean, rows: [[text, ...], ...] }, 1 to 12 rows, 1 to 5 columns,
--     every row the same width, each cell text of at most 120 characters (it may be empty and may hold {{variables}})
-- private.layout_problem keeps its name and signature (save_agreement_template and save_contract_template call it by name): the
-- current one moves to layout_problem_plain, and the wrapper validates the theme, the styles and the tables, strips them, and hands
-- the rest to it, as the letterhead wrapper before it did. Tables do not count as text blocks. Existing template versions are never
-- rewritten. NOT applied to the hosted project: applying it needs the owner's go-ahead.
alter function private.layout_problem(jsonb, jsonb, text[], text[]) rename to layout_problem_plain;

create function private.layout_problem(p_doc jsonb, p_layout jsonb, p_sections text[], p_once text[])
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_theme jsonb;
  v_item jsonb;
  v_kept jsonb := '[]'::jsonb;
  v_style jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_cell jsonb;
  v_width integer;
begin
  if jsonb_typeof(p_doc) = 'object' and p_doc ? 'theme' then
    v_theme := p_doc -> 'theme';
    if not coalesce(private.jsonb_keys_within(v_theme, '{}', array['accent', 'font']), false) then
      return 'theme must be { accent, font }, each optional';
    end if;
    if v_theme ? 'accent' and v_theme -> 'accent' not in ('"blue"'::jsonb, '"teal"'::jsonb, '"amber"'::jsonb, '"violet"'::jsonb, '"rose"'::jsonb, '"slate"'::jsonb) then
      return 'theme accent must be blue, teal, amber, violet, rose or slate';
    end if;
    if v_theme ? 'font' and v_theme -> 'font' not in ('"sans"'::jsonb, '"serif"'::jsonb) then
      return 'theme font must be sans or serif';
    end if;
    p_doc := p_doc - 'theme';
  end if;

  -- Anything that is not a list of items is the plain check's to refuse, in its own words.
  if jsonb_typeof(p_layout) is distinct from 'array' then
    return private.layout_problem_plain(p_doc, p_layout, p_sections, p_once);
  end if;
  if jsonb_array_length(p_layout) > 60 then
    return 'layout has more than 60 items';
  end if;

  for v_item in select e from jsonb_array_elements(p_layout) e loop
    if jsonb_typeof(v_item) = 'object' and v_item ->> 'kind' = 'table' then
      if not coalesce(private.jsonb_keys_within(v_item, array['kind', 'header', 'rows'], '{}'), false) then
        return 'a table must be { kind, header, rows }';
      end if;
      if jsonb_typeof(v_item -> 'header') is distinct from 'boolean' then
        return 'a table header must be true or false';
      end if;
      v_rows := v_item -> 'rows';
      if jsonb_typeof(v_rows) is distinct from 'array' or jsonb_array_length(v_rows) not between 1 and 12 then
        return 'a table needs 1 to 12 rows';
      end if;
      if jsonb_typeof(v_rows -> 0) is distinct from 'array' then
        return 'a table row must be a list of cells';
      end if;
      v_width := jsonb_array_length(v_rows -> 0);
      if v_width not between 1 and 5 then
        return 'a table needs 1 to 5 columns';
      end if;
      for v_row in select e from jsonb_array_elements(v_rows) e loop
        if jsonb_typeof(v_row) is distinct from 'array' or jsonb_array_length(v_row) <> v_width then
          return 'every row of a table must have the same number of cells';
        end if;
        for v_cell in select e from jsonb_array_elements(v_row) e loop
          if not private.jsonb_text_between(v_cell, 0, 120) then
            return 'a table cell must be text of at most 120 characters';
          end if;
        end loop;
      end loop;
      continue;
    end if;

    if jsonb_typeof(v_item) = 'object' and v_item ->> 'kind' = 'block' and v_item ? 'style' then
      v_style := v_item -> 'style';
      if not coalesce(private.jsonb_keys_within(v_style, '{}', array['align', 'bold', 'italic']), false) then
        return 'a block style must be { align, bold, italic }, each optional';
      end if;
      if v_style ? 'align' and v_style -> 'align' not in ('"left"'::jsonb, '"center"'::jsonb, '"right"'::jsonb) then
        return 'a block align must be left, center or right';
      end if;
      if (v_style ? 'bold' and jsonb_typeof(v_style -> 'bold') is distinct from 'boolean')
         or (v_style ? 'italic' and jsonb_typeof(v_style -> 'italic') is distinct from 'boolean') then
        return 'a block bold and italic must be true or false';
      end if;
      v_item := v_item - 'style';
    end if;
    v_kept := v_kept || jsonb_build_array(v_item);
  end loop;

  return private.layout_problem_plain(p_doc, v_kept, p_sections, p_once);
end $$;

revoke execute on function private.layout_problem(jsonb, jsonb, text[], text[]) from public, anon, authenticated;
revoke execute on function private.layout_problem_plain(jsonb, jsonb, text[], text[]) from public, anon, authenticated;
