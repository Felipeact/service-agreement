export type Variant = "a" | "b" | "c";

/** The three staff-app designs under review. They share every screen and all the data; they differ in the frame and the look. */
const ALL_VARIANTS: { key: Variant; name: string; idea: string }[] = [
  { key: "a", name: "Light Rail", idea: "The public site's frosted header is the navigation. No sidebar: the work gets the whole width. Panels are framed windows." },
  { key: "b", name: "Floating Panel", idea: "A white sidebar floats on the pale ground. Board columns are tinted by stage, and the plan quota is the one saturated block." },
  { key: "c", name: "Aurora Band", idea: "A slim icon rail and the public hero's glow along the top of every page. Flat hairline panels. A tab bar on a phone." },
];

/** Only the chosen design is offered; A and C stay in the code until the previews are removed. */
export const VARIANTS = ALL_VARIANTS.filter((variant) => variant.key === "b");

export const isVariant = (value: string): value is Variant => VARIANTS.some((variant) => variant.key === value);
