import type { CheckoutStarter, WorkspaceEmailCheck } from "@/application/ports";
import { parseCheckoutSelection, type FieldErrors, type SelectionInput } from "@/domain/billing";

export type StartTrialOutcome =
  | { status: "redirect"; url: string }
  | { status: "no_trade" | "invalid_choice" | "invalid_details"; fields: FieldErrors }
  | { status: "email_in_use" | "company_in_use" | "not_configured" | "unavailable" };

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
 * Validates the selection, asks whether the email already belongs to an org (when a check is given; a failed check is
 * `unavailable`, logged without the email), then asks the starter where the visitor goes next. A refusal is a value the page shows;
 * a failure of the starter, or a url that is not https, is `unavailable` and logged without the selection or the url.
 */
export function makeStartTrial(checkout: CheckoutStarter, emailCheck?: WorkspaceEmailCheck) {
  return async function startTrial(input: StartTrialInput): Promise<StartTrialOutcome> {
    const parsed = parseCheckoutSelection(input);
    if (!parsed.ok) return { status: parsed.code, fields: parsed.fields };

    if (emailCheck) {
      try {
        if (await emailCheck.inUse(parsed.value.email)) return { status: "email_in_use" };
        if (await emailCheck.companyInUse(parsed.value.company)) return { status: "company_in_use" };
      } catch (cause) {
        console.error(`Starting a trial failed: the email check threw ${cause instanceof Error ? cause.name : "a non-error"}`);
        return { status: "unavailable" };
      }
    }

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
