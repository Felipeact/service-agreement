"use client";

import { useActionState, useState } from "react";
import { termSummary, type AgreementTerm } from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { formatCadExact } from "@/lib/money";
import { contractMessageFor, type GenerateContractState } from "./contract-state";

type PromptProps = {
  /** Who would sign, or `null` when nobody on the site has an email. */
  signer: { name: string; email: string } | null;
  term: AgreementTerm;
  annualCents: number;
  confirming: boolean;
  pending: boolean;
  state: GenerateContractState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The generate action, bound to the agreement; absent in tests that only render markup. */
  action?: () => void;
};

/**
 * Two steps: "Generate contract" asks first and names who signs, the term and the price, because a contract with the
 * wrong signer cannot be regenerated yet (contract-generation AC 2).
 */
export function GenerateContractPrompt({ signer, term, annualCents, confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  const message = contractMessageFor(state.status);
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">Generate the contract? It freezes who signs and cannot be regenerated.</p>
          <p className="text-[13px] text-ink-2">Signer: {signer ? `${signer.name} · ${signer.email}` : "No signer with an email yet."}</p>
          <p className="text-[13px] text-ink-2">{termSummary(term)}</p>
          <p className="text-[13px] text-ink-2">
            Total per year <span>{formatCadExact(annualCents)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              Generate contract
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="primary" onClick={onStart}>
            Generate contract
          </Button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

type ControlProps = Pick<PromptProps, "signer" | "term" | "annualCents"> & { action: () => Promise<GenerateContractState> };

export function GenerateContractControl({ signer, term, annualCents, action }: ControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<GenerateContractState>(() => action(), { status: "idle" });
  return (
    <GenerateContractPrompt
      signer={signer}
      term={term}
      annualCents={annualCents}
      confirming={confirming}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
    />
  );
}
