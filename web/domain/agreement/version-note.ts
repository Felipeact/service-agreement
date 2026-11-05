/** The longest staff note a version takes (versioning AC 4); `save_version_note` enforces the same bound. */
export const MAX_NOTE_LENGTH = 500;

export type VersionNoteResult = { ok: true; value: string } | { ok: false; error: string };

/** The note trimmed, or why it is refused. An empty note is valid: it clears the note. */
export function validateVersionNote(raw: string): VersionNoteResult {
  const value = raw.trim();
  if (value.length > MAX_NOTE_LENGTH) return { ok: false, error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` };
  return { ok: true, value };
}
