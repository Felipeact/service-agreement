export type LibraryTask = { description: string; visitMonths: number[] | null };

/** An equipment type with its default visit months and checklist (task-library-page). */
export type LibraryType = {
  id: string;
  code: string;
  name: string;
  /** The pack the type was seeded from, or `null` for one made by hand (type-editor door 2). */
  pack: string | null;
  defaultVisitMonths: number[];
  tasks: LibraryTask[];
};

export type TaskLibraryValue = { defaultVisitMonths: number[]; tasks: LibraryTask[] };
