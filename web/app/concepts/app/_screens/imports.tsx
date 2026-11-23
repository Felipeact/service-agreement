"use client";

import Link from "next/link";
import { useState } from "react";
import { UploadIcon } from "lucide-react";
import { IMPORT_ROWS } from "../_components/data";
import { Back, Btn, Chip, PANEL, PageHead, Section, Table, TD, itemText } from "../_components/kit";
import { useToast } from "../_components/kit-client";
import { NewAgreementButton } from "../_components/new-agreement";
import { screenHref } from "../_components/shell-parts";

const HISTORY = [
  { id: "j1", file: "units-harbour-point.csv", site: "Harbour Point Tower", by: "Sam Okafor", when: "Nov 20", got: 34, of: 38, status: "Needs review" },
  { id: "j2", file: "boiler-room.xlsx", site: "Elm Street School", by: "Sam Okafor", when: "Nov 14", got: 12, of: 12, status: "Committed" },
  { id: "j3", file: "maple-court-inventory.pdf", site: "Maple Court Plaza", by: "Jordan Pike", when: "Nov 9", got: 51, of: 60, status: "Committed" },
];

/** Every list brought in so far, with how much of it was recognized. */
export function ImportsScreen() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Imports" sub="Every list you have brought in, and how much of it we recognized." actions={<NewAgreementButton label="Import for a new agreement" />} />
      <div className="flex flex-col items-start gap-3 rounded-panel border border-action/20 bg-linear-to-br from-action-tint to-surface p-5 sm:flex-row sm:items-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-action text-surface shadow-md shadow-action/25"><UploadIcon aria-hidden="true" className="size-5" /></span>
        <div className="mr-auto"><p className="text-[15px] font-bold">{itemText("Start from the customer's equipment list")}</p><p className="text-[13px] text-ink-nav">Drop an Excel, CSV, Word or PDF file and we write the service lines.</p></div>
        <NewAgreementButton label="New agreement" />
      </div>
      <ul className="stagger grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {HISTORY.map((job) => (
          <li key={job.id} className={`${PANEL} flex flex-col gap-3 p-5`}>
            <div className="flex items-start gap-2"><div className="mr-auto min-w-0"><Link href={screenHref("import-job")} className="flex min-h-11 items-center truncate text-[15px] font-semibold hover:text-action lg:min-h-0">{job.file}</Link><p className="text-[12px] text-ink-2">{job.site} · {job.by} · {job.when}</p></div><Chip tone={job.status === "Committed" ? "good" : "attention"}>{job.status}</Chip></div>
            <div><div className="flex justify-between text-[12px] text-ink-nav"><span>Recognition</span><span className="font-semibold">{job.got} of {job.of} rows</span></div><div role="progressbar" aria-label="Rows recognized" aria-valuemin={0} aria-valuemax={job.of} aria-valuenow={job.got} className="mt-1.5 h-2 overflow-hidden rounded-full bg-board"><div className="h-full rounded-full bg-stage-completed" style={{ width: `${(job.got / job.of) * 100}%` }} /></div></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TYPES = ["Rooftop unit", "Boiler", "Exhaust fan", "Backflow preventer", "Split system"];

/** One import job: each row is matched to a type; low-confidence and unmatched rows are flagged for a person. */
export function ImportJobScreen() {
  const [types, setTypes] = useState(() => Object.fromEntries(IMPORT_ROWS.map((row) => [row.id, row.type])));
  const toast = useToast();
  const missing = IMPORT_ROWS.filter((row) => !types[row.id]).length;
  return (
    <div className="flex flex-col gap-6">
      <Back href={screenHref("imports")}>Imports</Back>
      <PageHead title={itemText("equipment.csv")} badge={<Chip tone="attention">Needs review</Chip>} sub="Harbour Point Tower · uploaded by Sam Okafor, Nov 20" />
      <Section title="Column mapping" sub="Where we found each piece of a row.">
        <div className="grid gap-3 sm:grid-cols-3">{[["Name", "Column A"], ["Model", "Column B"], ["Location", "Column D"]].map(([k, v]) => <div key={k} className="rounded-control bg-board px-3 py-2 text-[13px]"><span className="text-ink-2">{k}</span><p className="font-semibold">{v}</p></div>)}</div>
      </Section>
      <Section flush title="Rows" sub={missing > 0 ? `${missing} row still needs a type` : "Every row has a type"} action={<Btn variant="primary" disabled={missing > 0} onClick={() => toast.show("Rows saved to Harbour Point Tower")}>Save rows</Btn>}>
        <Table head={["As written", "Type", "Match"]}>
          {IMPORT_ROWS.map((row) => (
            <tr key={row.id}>
              <td className={`${TD} font-semibold`}>{row.raw}</td>
              <td className={TD}><label><span className="sr-only">Type for {row.raw}</span><select value={types[row.id]} onChange={(e) => setTypes({ ...types, [row.id]: e.target.value })} aria-invalid={!types[row.id] || undefined} className="h-11 w-full min-w-44 rounded-control border border-field bg-surface px-3 text-[14px] aria-[invalid=true]:border-danger lg:h-9"><option value="">Choose a type</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label></td>
              <td className={TD}>{!types[row.id] ? <Chip tone="bad">Not matched</Chip> : row.conf < 70 && types[row.id] === row.type ? <Chip tone="attention">Check ({row.conf}%)</Chip> : <Chip tone="good">OK</Chip>}</td>
            </tr>
          ))}
        </Table>
      </Section>
      {toast.node}
    </div>
  );
}
