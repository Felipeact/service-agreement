-- recommended-lines: a service line the app proposed from the site's equipment carries a "Recommended" tag until a person
-- reviews it. The tag is cleared by keeping the line as it is (a direct update of the flag) or by editing it: any change to
-- its description, months or price through save_service_line clears it in the same statement, so an edited line never
-- still reads as the app's suggestion. Sending is refused in the app while a recommended line is left on the draft.

alter table public.service_lines
  add column recommended boolean not null default false;

comment on column public.service_lines.recommended is
  'Proposed by the app from the site''s equipment and not yet reviewed by a person (recommended-lines).';

create function private.service_lines_review_recommendation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.recommended and new.recommended
     and (new.description is distinct from old.description
          or new.visit_months is distinct from old.visit_months
          or new.cost_per_visit_cents is distinct from old.cost_per_visit_cents) then
    new.recommended := false;
  end if;
  return new;
end $$;

revoke execute on function private.service_lines_review_recommendation() from public, anon, authenticated;

create trigger service_lines_review_recommendation before update on public.service_lines
  for each row execute function private.service_lines_review_recommendation();
