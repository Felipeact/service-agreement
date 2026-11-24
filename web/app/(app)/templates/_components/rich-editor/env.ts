/** What a template editor page hands the Word-style editor about the company (read on the server, plain values only). */
export type EditorPageEnv = {
  orgName: string;
  address: string | null;
  phone: string | null;
  /** The company's own colour, used when the template sets none. */
  accent: string;
  logoUrl: string | null;
  /** The public address an uploaded picture's key is appended to. */
  imageBase: string;
  /** The org's recent agreements, to preview the page on real data. */
  agreements: { id: string; label: string }[];
};
