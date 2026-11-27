/**
 * The public site's chat agent (site agent door 1): what a visitor may ask, what the model may answer, and the few pages it may
 * point to. It knows only the public site's own words, never a customer, an account or the database, and it offers links, never actions.
 * Nothing here reads a clock, the database or the network.
 */

export const MAX_QUESTION_LENGTH = 400;
/** Earlier turns sent along so a follow-up makes sense. */
export const MAX_HISTORY_TURNS = 8;
export const MAX_ANSWER_LENGTH = 900;
/** Questions one open chat may ask before it points the visitor to a person. The server's per-address limits back this up. */
export const MAX_SESSION_QUESTIONS = 12;

export type SiteAgentTurn = { role: "user" | "assistant"; text: string };

/** The only pages the agent may link to: the buttons the visitor is offered. */
export const LINK_PATHS = ["/register", "/demo", "/contact", "/pricing", "/product", "/trades", "/faq", "/security"] as const;
export type LinkPath = (typeof LINK_PATHS)[number];
export type SiteAgentLink = { path: LinkPath; label: string };

export const LINK_LABELS: Record<LinkPath, string> = {
  "/register": "Get started",
  "/demo": "See the demo",
  "/contact": "Contact us",
  "/pricing": "See pricing",
  "/product": "How it works",
  "/trades": "Trades we fit",
  "/faq": "Read the FAQ",
  "/security": "Security",
};

export type SiteAgentReply = { answer: string; link: SiteAgentLink | null };
export type SiteAgentResult = { ok: true; reply: SiteAgentReply } | { ok: false; error: string };

export const UNAVAILABLE_MESSAGE = "The assistant can't answer right now. Please try again in a moment, or write to us from the contact page.";
export const BUSY_MESSAGE = "You have asked a lot of questions in a short time. Please wait a little, or write to us from the contact page.";

export type QuestionCheck = { ok: true; question: string } | { ok: false; error: string };

export function validateQuestion(input: unknown): QuestionCheck {
  const question = typeof input === "string" ? input.trim() : "";
  if (question.length === 0) return { ok: false, error: "Type a question first." };
  if (question.length > MAX_QUESTION_LENGTH) return { ok: false, error: `Keep the question under ${MAX_QUESTION_LENGTH} characters.` };
  return { ok: true, question };
}

/** The earlier turns, kept to the last few and to well-formed ones; anything else is dropped. */
export function cleanHistory(input: unknown): SiteAgentTurn[] {
  if (!Array.isArray(input)) return [];
  const turns: SiteAgentTurn[] = [];
  for (const raw of input) {
    const turn = raw as Partial<SiteAgentTurn> | null;
    if (turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string" && turn.text.trim() !== "") {
      turns.push({ role: turn.role, text: turn.text.slice(0, turn.role === "user" ? MAX_QUESTION_LENGTH : MAX_ANSWER_LENGTH) });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

/** The model's JSON answer as a reply, or `null` when it is not the shape asked for. A link that is not one of the allowed pages is dropped; the answer stays. */
export function readReply(text: string): SiteAgentReply | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const { answer, link } = (raw ?? {}) as Record<string, unknown>;
  if (typeof answer !== "string" || answer.trim() === "") return null;
  const path = (LINK_PATHS as readonly unknown[]).includes(link) ? (link as LinkPath) : null;
  return { answer: answer.trim().slice(0, MAX_ANSWER_LENGTH), link: path ? { path, label: LINK_LABELS[path] } : null };
}
