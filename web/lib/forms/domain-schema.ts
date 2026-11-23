import { z } from "zod";

type Checked = { ok: true } | { ok: false; errors: Partial<Record<string, string>> };

/**
 * A Zod schema for a form whose rules already live in a domain validator. The fields are plain strings (what a form holds);
 * the validator then judges them, and each message it gives lands on its field. The rules stay written once, in the
 * domain, so the browser and the server action can never disagree about what is valid.
 */
export function domainSchema<Shape extends z.ZodRawShape>(shape: Shape, validate: (input: z.infer<z.ZodObject<Shape>>) => Checked) {
  return z.object(shape).superRefine((input, context) => {
    const checked = validate(input as z.infer<z.ZodObject<Shape>>);
    if (checked.ok) return;
    for (const [field, message] of Object.entries(checked.errors)) {
      if (message) context.addIssue({ code: "custom", path: [field], message });
    }
  });
}

/** A form text field: a string, empty by default, so an untouched field validates like a blank one. */
export const text = () => z.string().default("");
