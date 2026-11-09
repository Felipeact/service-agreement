import type { CheckoutStarter } from "@/application/ports";
import { parseCheckoutSelection, type FieldErrors, type SelectionInput } from "@/domain/billing";

export type StartTrialOutcome =
  | { status: "redirect"; url: string }
  | { status: "no_trade" | "invalid_choice" | "invalid_details"; fields: FieldErrors }
  | { status: "not_configured" | "unavailable" };

/** What a form posted, before anything is trusted (pricing-page S2, register-seats). */
export type StartTrialInput = SelectionInput;

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Validates the selection, then asks the starter where the visitor goes next. A refusal is a value the page shows;
 * a failure of the starter, or a url that is not https, is `unavailable` and logged without the selection or the url.
 */
export function makeStartTrial(checkout: CheckoutStarter) {
  return async function startTrial(input: StartTrialInput): Promise<StartTrialOutcome> {
    const parsed = parseCheckoutSelection(input);
    if (!parsed.ok) return { status: parsed.code, fields: parsed.fields };

    let answer;
    try {
      answer = await checkout.start(parsed.value);
    } catch (cause) {
      console.error(`Starting a trial failed: the checkout starter threw ${cause instanceof Error ? cause.name : "a non-error"}`);
      return { status: "unavailable" };
    }

    if (!answer.ok) {
      if (answer.code === "unavailable") console.error("Starting a trial failed: the checkout starter was unavailable");
      return { status: answer.code };
    }
    if (!isHttps(answer.url)) {
      console.error("Starting a trial failed: the checkout starter answered with a url that is not https");
      return { status: "unavailable" };
    }
    return { status: "redirect", url: answer.url };
  };
}
