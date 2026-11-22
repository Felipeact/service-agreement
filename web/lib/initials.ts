/**
 * Up to two capital letters that stand for a name or an email, for an avatar or a workspace tile:
 * "Maple Court Plaza" gives "MC", "service pacts" gives "SP", "jamie.lee@x.ca" gives "JL", "alex@x.ca" gives "AL".
 * Falls back to "?" for an empty text.
 */
export function initialsOf(text: string): string {
  const source = text.includes("@") ? text.split("@")[0] : text;
  const words = source.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? Array.from(words[0]).slice(0, 2) : words.slice(0, 2).map((word) => Array.from(word)[0]);
  return letters.join("").toUpperCase();
}
