"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LogoUploadAnswer } from "@/app/logo-upload";

/** The three server actions the editor's logo control needs. A page passes them in; a screen without them shows no logo control. */
export type LogoActions = {
  current: () => Promise<string | null>;
  save: (path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  prepare: (file: { type: string; size: number }) => Promise<LogoUploadAnswer>;
};

const Context = createContext<LogoActions | null>(null);

export function LogoActionsProvider({ actions, children }: { actions: LogoActions; children: ReactNode }) {
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}

export const useLogoActions = () => useContext(Context);
