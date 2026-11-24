"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PencilIcon, PlusIcon } from "lucide-react";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import type { SiteEditState } from "../_actions/site";
import { GuidedSection } from "./guided";
import { field, linkButton, primaryButton, secondaryButton, units } from "./styles";

/** One equipment type on the site, as the page edits it. */
export type SiteType = { assetTypeId: string; code: string; name: string; units: number; location: string };

type SetCount = (input: { siteId: string; assetTypeId: string; count: number; location: string | null }) => Promise<SiteEditState>;

/** What a refusal says, in the default word (spoken in the org's words where shown). */
function failure(state: SiteEditState, siteId: string): { text: string; link?: string } | null {
  switch (state.status) {
    case "saved":
      return null;
    case "tagged":
      return { text: `${state.tagged} ${state.tagged === 1 ? "unit has" : "units have"} its own unit number or model, so lower the count on the site page.`, link: `/sites/${siteId}` };
    case "in_term":
      return { text: "A unit of this type is in an agreement that is in term, so it stays on the site." };
    case "invalid":
      return { text: "Enter a count from 0 to 500." };
    case "forbidden":
      return { text: "You cannot change this site." };
    default:
      return { text: "The change could not be saved. Try again." };
  }
}

function Failure({ state, siteId, words }: { state: SiteEditState; siteId: string; words: ItemWords }) {
  const message = failure(state, siteId);
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {itemText(message.text, words)}{" "}
      {message.link && (
        <Link href={message.link} className="inline-flex min-h-11 items-center underline lg:min-h-0">
          Open the site
        </Link>
      )}
    </p>
  );
}

/** One type on the site: its count and location, edited in place, or removed. */
function EquipmentRow({ type, siteId, setCount, words }: { type: SiteType; siteId: string; setCount: SetCount; words: ItemWords }) {
  const [isEditing, setIsEditing] = useState(false);
  const [count, setCountText] = useState(String(type.units));
  const [location, setLocation] = useState(type.location);
  const [state, setState] = useState<SiteEditState>({ status: "saved" });
  const [isPending, startTransition] = useTransition();

  function save(nextCount: number, nextLocation: string | null) {
    startTransition(async () => {
      const result = await setCount({ siteId, assetTypeId: type.assetTypeId, count: nextCount, location: nextLocation }).catch(() => ({ status: "unavailable" }) as const);
      setState(result);
      if (result.status === "saved") setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <li className="flex items-center justify-between gap-3 px-5 py-2 text-[14px]">
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{type.name}</span>
          {type.location && <span className="text-[12px] text-ink-2">{type.location}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="tabular-nums text-ink-2">{units(type.units)}</span>
          <button
            type="button"
            onClick={() => {
              setCountText(String(type.units));
              setLocation(type.location);
              setIsEditing(true);
            }}
            aria-label={`Edit ${type.name}`}
            className="flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-board hover:text-ink lg:size-8"
          >
            <PencilIcon className="size-4" aria-hidden="true" />
          </button>
        </span>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 bg-ground px-5 py-3">
      <p className="text-[14px] font-semibold">{type.name}</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Units
          <input inputMode="numeric" value={count} onChange={(event) => setCountText(event.target.value.replace(/\D/g, ""))} className={`w-24 tabular-nums ${field}`} />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-medium">
          Location or tag
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="For example Roof, or RTU-1 to RTU-7" maxLength={200} className={field} />
        </label>
      </div>
      <Failure state={state} siteId={siteId} words={words} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Number(count) < 1 || isPending} onClick={() => save(Number(count), location.trim() === type.location ? null : location)} className={primaryButton}>
          {isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setIsEditing(false)} disabled={isPending} className={secondaryButton}>
          Cancel
        </button>
        <button type="button" onClick={() => save(0, null)} disabled={isPending} className="ml-auto inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-danger hover:underline lg:min-h-9">
          Remove from site
        </button>
      </div>
    </li>
  );
}

/**
 * The Equipment section's body (approved design): the site's types with their counts and locations, each edited in place
 * (count, location, remove from site), and a form to add a kind from the org's catalog. Shown with "Show and edit".
 */
export function EquipmentSection({
  section,
  siteId,
  types,
  addable,
  setCount,
  words = DEFAULT_ITEM_WORDS,
}: {
  /** The section frame: its anchor, name, title, state line and tick. */
  section: { id: string; label: string; title: string; state: string; isDone?: boolean };
  siteId: string;
  types: SiteType[];
  addable: { id: string; name: string }[];
  setCount: SetCount;
  words?: ItemWords;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [adding, setAdding] = useState({ assetTypeId: "", units: "1", location: "" });
  const [state, setState] = useState<SiteEditState>({ status: "saved" });
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const count = Number(adding.units);
    if (!adding.assetTypeId || count < 1) return;
    startTransition(async () => {
      const result = await setCount({ siteId, assetTypeId: adding.assetTypeId, count, location: adding.location.trim() || null }).catch(() => ({ status: "unavailable" }) as const);
      setState(result);
      if (result.status === "saved") setAdding({ assetTypeId: "", units: "1", location: "" });
    });
  }

  return (
    <GuidedSection
      {...section}
      action={
        <button type="button" aria-expanded={isOpen} aria-controls="site-types" onClick={() => setIsOpen(!isOpen)} className={linkButton}>
          {isOpen ? "Hide" : "Show and edit"}
        </button>
      }
    >
      {isOpen && (
      <div id="site-types">
        <ul className="divide-y divide-hairline">
          {types.map((type) => (
            <EquipmentRow key={`${type.assetTypeId}:${type.units}:${type.location}`} type={type} siteId={siteId} setCount={setCount} words={words} />
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleAdd();
          }}
          className="flex flex-wrap items-end gap-3 border-t border-hairline bg-ground px-5 py-4"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-medium">
            {itemText("Add equipment", words)}
            <select value={adding.assetTypeId} onChange={(event) => setAdding({ ...adding, assetTypeId: event.target.value })} className={field}>
              <option value="">Choose a kind</option>
              {addable.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Units
            <input inputMode="numeric" value={adding.units} onChange={(event) => setAdding({ ...adding, units: event.target.value.replace(/\D/g, "") })} className={`w-20 tabular-nums ${field}`} />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] font-medium">
            Location
            <input value={adding.location} onChange={(event) => setAdding({ ...adding, location: event.target.value })} placeholder="Optional" maxLength={200} className={field} />
          </label>
          <button type="submit" disabled={!adding.assetTypeId || Number(adding.units) < 1 || isPending} className={primaryButton}>
            <PlusIcon className="size-4" aria-hidden="true" /> {isPending ? "Adding…" : "Add"}
          </button>
          <div className="w-full">
            <Failure state={state} siteId={siteId} words={words} />
          </div>
          <p className="w-full text-[12px] text-ink-2">Have a list? Upload it from the site page and the rows are added for you.</p>
        </form>
      </div>
      )}
    </GuidedSection>
  );
}
