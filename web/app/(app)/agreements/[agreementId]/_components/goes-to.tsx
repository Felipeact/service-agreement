"use client";

import { useState, useTransition } from "react";
import type { SiteEditState } from "../_actions/site";
import { field, linkButton, panel, primaryButton } from "./styles";

type Props = {
  siteId: string;
  name: string | null;
  email: string | null;
  address: string | null;
  change: (input: { siteId: string; name: string; email: string }) => Promise<SiteEditState>;
};

const MESSAGES: Partial<Record<SiteEditState["status"], string>> = {
  invalid: "Enter a name and a valid email.",
  forbidden: "You cannot change this contact.",
  not_found: "The site could not be found.",
};

/** "Goes to" (approved design): who the agreement is emailed to, changed in place (the site contact's name and email). */
export function GoesTo({ siteId, name, email, address, change }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ name: name ?? "", email: email ?? "" });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await change({ siteId, name: draft.name, email: draft.email }).catch(() => ({ status: "unavailable" }) as const);
      if (result.status === "saved") {
        setIsEditing(false);
        setMessage(null);
      } else setMessage(MESSAGES[result.status] ?? "The contact could not be saved. Try again.");
    });
  }

  return (
    <section aria-label="Goes to" className={`flex flex-col gap-2 p-5 text-[14px] ${panel}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Goes to</h2>
        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setDraft({ name: name ?? "", email: email ?? "" });
              setIsEditing(true);
            }}
            className={linkButton}
          >
            Change
          </button>
        )}
      </div>
      {isEditing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-2"
        >
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Name
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={120} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Email
            <input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required maxLength={254} className={field} />
          </label>
          {message && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {message}
            </p>
          )}
          <button type="submit" disabled={isPending} className={primaryButton}>
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        <>
          <p>
            {name ?? "No contact yet"}
            <span className="block break-all text-ink-2">{email ?? "No email yet"}</span>
          </p>
          {address && <p className="text-ink-2">{address}</p>}
        </>
      )}
    </section>
  );
}
