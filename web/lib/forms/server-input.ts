import { z } from "zod";

/** A record id from a route or a bound argument: a UUID in any version. Anything else is not a record this org can have. */
export const idSchema = z.guid();

/** Whether `value` is a well-formed id; a server action refuses anything else before it asks the database. */
export function isId(value: unknown): value is string {
  return idSchema.safeParse(value).success;
}

/**
 * The named text fields of a posted form, as a typed object. A field the form did not post, or posted as a file, reads as
 * the empty string: the domain validator then speaks about it, as it does for a blank one. Only these names are read, so an
 * extra field a caller adds (an org id, a role) never reaches the action.
 */
export function readFields<Name extends string>(formData: FormData, names: readonly Name[]): Record<Name, string> {
  const shape = Object.fromEntries(names.map((name) => [name, z.string()])) as Record<Name, z.ZodString>;
  const posted = Object.fromEntries(names.map((name) => [name, typeof formData.get(name) === "string" ? formData.get(name) : ""]));
  return z.object(shape).parse(posted) as Record<Name, string>;
}

/** The same, for the fields the form chose to post: a name the form did not post is left out, so a stored value is left alone. */
export function readPostedFields<Name extends string>(formData: FormData, names: readonly Name[]): Partial<Record<Name, string>> {
  const posted = names.filter((name) => formData.has(name));
  return readFields(formData, posted);
}
