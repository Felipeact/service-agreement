"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { linkMessageFor, type LinkState } from "./state";

function Alert({ state }: { state: LinkState }) {
  const message = linkMessageFor(state.status);
  return message ? (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  ) : null;
}

type PromptProps = {
  confirming: boolean;
  pending: boolean;
  state: LinkState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The action, bound to the agreement; absent in tests that only render markup. */
  action?: () => void;
};

type SendPromptProps = PromptProps & { number: string };

/** Two steps: "Send to customer" asks first and says what sending does (customer-portal AC 1). */
export function SendPrompt({ number, confirming, pending, state, onStart, onCancel, action }: SendPromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">{`Send ${number} to the customer? Its lines, scope and terms are locked and a link is created.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              Send
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="primary" onClick={onStart}>
            Send to customer
          </Button>
        </div>
      )}
      <Alert state={state} />
    </div>
  );
}

/** Two steps: "Get a new link" asks first, because the old address stops working (customer-portal AC 4). */
export function ReissuePrompt({ confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">The link already given to the customer stops working. Create a new one?</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              Get a new link
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>Get a new link</Button>
        </div>
      )}
      <Alert state={state} />
    </div>
  );
}

type LinkPanelProps = { url: string; copied?: boolean; onCopy?: () => void };

/** The full link, shown once: it is not stored and cannot be shown again (customer-portal AC 7). */
export function LinkPanel({ url, copied = false, onCopy }: LinkPanelProps) {
  return (
    <section aria-label="Customer link" className="flex flex-col gap-2 rounded-panel border border-hairline bg-surface px-4 py-3">
      <h2 className="text-[13px] font-semibold">Customer link</h2>
      <p className="text-[13px] text-ink-2">Copy it now. It is shown only once; if it is lost, get a new link.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Customer link address"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-hairline bg-ground px-3 text-[13px] lg:min-h-[34px]"
        />
        <Button variant="primary" onClick={onCopy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </section>
  );
}

type LinkControlsProps = {
  number: string;
  /** Sending is offered on the current version of a draft. */
  canSend: boolean;
  /** A new link is offered on the current version of a sent agreement. */
  canReissue: boolean;
  send: () => Promise<LinkState>;
  reissue: () => Promise<LinkState>;
};

/**
 * One component for the whole send-and-link flow, so the link a send returns survives the page re-rendering the
 * agreement as `sent`: the draft's Send control gives way to "Get a new link" in the same place.
 */
export function LinkControls({ number, canSend, canReissue, send, reissue }: LinkControlsProps) {
  const [sending, setSending] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendState, sendAction, sendPending] = useActionState<LinkState>(() => send(), { status: "idle" });
  const [reissueState, reissueAction, reissuePending] = useActionState<LinkState>(() => reissue(), { status: "idle" });
  const [shown, setShown] = useState<"send" | "reissue">("send");

  const latest = shown === "reissue" ? reissueState : sendState;
  const url = "url" in latest ? latest.url : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url ?? "");
      setCopied(true);
    } catch {
      // The address is selectable in the field above; copying by hand still works.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2.5">
        {canSend && (
          <SendPrompt
            number={number}
            confirming={sending}
            pending={sendPending}
            state={sendState}
            onStart={() => setSending(true)}
            onCancel={() => setSending(false)}
            action={() => {
              setShown("send");
              setSending(false);
              setCopied(false);
              sendAction();
            }}
          />
        )}
        {canReissue && (
          <ReissuePrompt
            confirming={reissuing}
            pending={reissuePending}
            state={reissueState}
            onStart={() => setReissuing(true)}
            onCancel={() => setReissuing(false)}
            action={() => {
              setShown("reissue");
              setReissuing(false);
              setCopied(false);
              reissueAction();
            }}
          />
        )}
      </div>
      {url && <LinkPanel url={url} copied={copied} onCopy={copy} />}
    </div>
  );
}
