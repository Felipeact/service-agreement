"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EyeIcon, FileTextIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { TEMPLATES } from "../_components/data";
import { Back, Btn, Chip, Field, INPUT, LinkBtn, PANEL, PageHead, Section, itemText } from "../_components/kit";
import { Modal, Tabs, useToast } from "../_components/kit-client";
import { NewAgreementButton } from "../_components/new-agreement";
import { screenHref } from "../_components/shell-parts";

type Kind = "Agreement" | "Contract wording";

/** The template library: agreement layouts and the contract wording, with use, duplicate and archive. */
export function TemplatesScreen() {
  const [kind, setKind] = useState<Kind>("Agreement");
  const [archived, setArchived] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const toast = useToast();
  const rows = TEMPLATES.filter((t) => t.kind === kind && !archived.includes(t.id));
  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Agreement templates" sub="Layouts your estimators start from. Customers see your logo and colour on every one." actions={<LinkBtn href={screenHref("template-editor")} variant="primary"><PlusIcon aria-hidden="true" />New template</LinkBtn>} />
      <Tabs<Kind> label="Template kind" value={kind} onChange={setKind} tabs={[{ key: "Agreement", label: "Agreement" }, { key: "Contract wording", label: "Contract wording" }]} />
      <ul className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => (
          <li key={t.id} className={`${PANEL} flex flex-col gap-4 p-5`}>
            <button type="button" onClick={() => setPreview(t.name)} aria-label={`Preview ${t.name}`} className="flex h-36 flex-col gap-2 rounded-card border border-hairline bg-ground p-4 text-left transition-colors hover:border-action">
              <span className="h-2 w-24 rounded bg-ink/80" /><span className="h-1.5 w-40 rounded bg-line-strong" /><span className="mt-1 h-1.5 w-full rounded bg-board" /><span className="h-1.5 w-5/6 rounded bg-board" /><span className="h-1.5 w-2/3 rounded bg-board" /><span className="mt-auto flex items-center gap-1 text-[11px] font-semibold text-action"><EyeIcon aria-hidden="true" className="size-3.5" />Preview</span>
            </button>
            <div><div className="flex items-center gap-2"><h2 className="mr-auto text-[15px] font-semibold">{t.name}</h2><Chip tone="info">{t.kind}</Chip></div><p className="text-[12px] text-ink-2">Used on {t.uses} agreements · edited {t.updated}</p></div>
            <div className="flex flex-wrap gap-2">
              {t.kind === "Agreement" ? <NewAgreementButton label="Use template" variant="primary" className="h-9 lg:h-8" /> : <LinkBtn href={screenHref("contract-wording")} variant="primary" className="h-9 lg:h-8">Edit wording</LinkBtn>}
              <LinkBtn href={screenHref("template-editor")} className="h-9 lg:h-8">Edit</LinkBtn>
              <Btn className="h-9 lg:h-8" onClick={() => toast.show(`Duplicated ${t.name}`)}><CopyIcon aria-hidden="true" />Duplicate</Btn>
              <Btn variant="ghost" className="h-9 lg:h-8" onClick={() => { setArchived([...archived, t.id]); toast.show(`Archived ${t.name}`); }}>Archive</Btn>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="rounded-panel border border-dashed border-line-strong px-6 py-12 text-center text-[13px] text-ink-2">Nothing here. Archived templates stay on past agreements.</p>}
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview ?? ""} sub="Sample data" wide><div className="mx-auto flex max-w-xl flex-col gap-3 rounded-card bg-board p-6"><FileTextIcon aria-hidden="true" className="size-6 text-action" /><p className="text-[14px] text-ink-nav">A rendered page with your logo, price lines, the visit schedule and the signature block.</p></div></Modal>
      {toast.node}
    </div>
  );
}

type Block = { id: string; type: string; text: string };
const START: Block[] = [{ id: "b1", type: "Heading", text: "Service agreement" }, { id: "b2", type: "Text", text: "This agreement covers preventive maintenance at the site below." }, { id: "b3", type: "Price lines", text: "" }, { id: "b4", type: "Visit schedule", text: "" }, { id: "b5", type: "Clause", text: "Payment is due net 30 days from the date of each invoice." }];
const ADDABLE = ["Heading", "Text", "Clause", "Price lines", "Visit schedule", "Service included", itemText("Equipment")];

/** The template editor: an ordered list of blocks you add, move, edit and remove. Up and down buttons stand in for drag, so a phone can reorder too. */
export function TemplateEditorScreen({ contract = false }: { contract?: boolean }) {
  const [blocks, setBlocks] = useState(contract ? START.filter((b) => b.type === "Heading" || b.type === "Clause" || b.type === "Text") : START);
  const [name, setName] = useState(contract ? "Contract wording" : "Standard agreement");
  const [pdf, setPdf] = useState(false);
  const toast = useToast();
  const move = (index: number, step: number) => setBlocks((list) => { const next = [...list]; const [item] = next.splice(index, 1); next.splice(index + step, 0, item); return next; });
  const addable = contract ? ["Heading", "Text", "Clause"] : ADDABLE;
  return (
    <div className="flex flex-col gap-6">
      <Back href={screenHref("templates")}>Templates</Back>
      <PageHead title={contract ? "Contract wording" : "Edit template"} sub={contract ? "The wording that follows an accepted agreement." : "Blocks run top to bottom on the page your customer sees."} actions={<><Btn onClick={() => setPdf(true)}><EyeIcon aria-hidden="true" />Preview PDF</Btn><Btn variant="primary" onClick={() => toast.show(contract ? "Wording saved" : "Template saved")}>{contract ? "Save wording" : "Save template"}</Btn></>} />
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Section title="Details"><div className="flex flex-col gap-3"><Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} /></Field><Field label="Document title"><input defaultValue="Service agreement" className={INPUT} /></Field></div></Section>
          <Section title="Add a block"><div className="grid grid-cols-2 gap-2">{addable.map((type) => <Btn key={type} onClick={() => setBlocks([...blocks, { id: `n${blocks.length}${type}`, type, text: type === "Heading" || type === "Text" || type === "Clause" ? "" : "" }])} className="justify-start"><PlusIcon aria-hidden="true" />{type}</Btn>)}</div></Section>
        </div>
        <Section title="Page" sub={`${blocks.length} blocks`}>
          {blocks.length === 0 ? <p className="py-8 text-center text-[13px] text-ink-2">Add a block to start.</p> : (
            <ol className="flex flex-col gap-3">
              {blocks.map((block, index) => (
                <li key={block.id} className="rounded-card border border-hairline bg-ground/60 p-3">
                  <div className="flex items-center gap-2"><Chip tone="info">{block.type}</Chip><span className="mr-auto" />
                    <Btn variant="ghost" aria-label={`Move ${block.type} up`} disabled={index === 0} onClick={() => move(index, -1)} className="size-11 px-0 lg:size-8"><ArrowUpIcon aria-hidden="true" /></Btn>
                    <Btn variant="ghost" aria-label={`Move ${block.type} down`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)} className="size-11 px-0 lg:size-8"><ArrowDownIcon aria-hidden="true" /></Btn>
                    <Btn variant="ghost" aria-label={`Remove ${block.type}`} onClick={() => setBlocks(blocks.filter((b) => b.id !== block.id))} className="size-11 px-0 text-danger lg:size-8"><Trash2Icon aria-hidden="true" /></Btn></div>
                  {["Heading", "Text", "Clause"].includes(block.type) ? <label className="mt-2 block"><span className="sr-only">{block.type} text</span><textarea value={block.text} onChange={(e) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, text: e.target.value } : b)))} rows={block.type === "Heading" ? 1 : 2} placeholder={`${block.type} text`} className={`${INPUT} h-auto min-h-11 py-2.5`} /></label> : <p className="mt-2 text-[13px] text-ink-2">Filled in from each agreement.</p>}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
      <Modal open={pdf} onClose={() => setPdf(false)} title="PDF preview" sub="Sample data" wide><div className="mx-auto flex max-w-xl flex-col gap-3 rounded-card bg-board p-6">{blocks.map((b) => <p key={b.id} className={b.type === "Heading" ? "text-[18px] font-bold" : "text-[13px] text-ink-nav"}>{b.text || `[${b.type}]`}</p>)}</div></Modal>
      {toast.node}
    </div>
  );
}
