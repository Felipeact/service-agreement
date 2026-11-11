"use client";

import { useEffect, useState } from "react";
import type { LogoUploadAnswer } from "@/app/logo-upload";
import { buttonClass } from "@/components/ui/button";
import { logoPublicUrl } from "@/domain/org-settings/logo";
import { putToStorage, uploadLogo, type LogoPicked } from "./logo-upload";

export type LogoStatus = "idle" | "uploading" | "ready" | "error";

type LogoFieldViewProps = {
  /** The key the form will save: the stored one, a freshly uploaded one, or `""` for none. */
  path: string;
  /** What to draw: the file just picked, or the stored logo's public address; `null` for none. */
  src: string | null;
  status: LogoStatus;
  error?: string;
  readOnly: boolean;
  onPick?: (file: File) => void;
  onRemove?: () => void;
};

const NOTE = "PNG or JPEG, up to 1 MB";

/** The logo control as markup. Presentational: `LogoField` owns the state. The hidden `logoPath` is what Save stores. */
export function LogoFieldView({ path, src, status, error, readOnly, onPick, onRemove }: LogoFieldViewProps) {
  const has = path !== "";
  return (
    <div className="flex flex-col gap-2">
      <span id="logo-label" className="text-[13px] font-medium text-ink">
        Logo
      </span>
      <div className="flex flex-wrap items-center gap-4 rounded-control bg-ground p-4">
        {has && src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a public Storage URL or a local preview of the owner's own file
          <img src={src} alt="Your company logo" className="max-h-12 w-auto max-w-40 object-contain" />
        ) : (
          <span className="text-[13px] text-ink-2">{has ? "Logo saved" : "No logo yet"}</span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          {status === "ready" && <span className="text-[13px] font-medium text-ink">Logo ready</span>}
          {status === "uploading" && <span className="text-[13px] font-medium text-ink">Uploading logo</span>}
          {!has && status === "idle" && <span className="text-[12px] text-ink-2">{NOTE}</span>}
          {status === "ready" && <span className="text-[12px] text-ink-2">Save to use it on your agreements.</span>}
        </div>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${buttonClass("secondary", "cursor-pointer")} ${status === "uploading" ? "pointer-events-none opacity-50" : ""}`}>
            {has ? "Replace logo" : "Choose logo"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              aria-labelledby="logo-label"
              className="sr-only"
              disabled={status === "uploading"}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) onPick?.(file);
              }}
            />
          </label>
          {has && (
            <button type="button" className={buttonClass("secondary")} disabled={status === "uploading"} onClick={onRemove}>
              Remove logo
            </button>
          )}
          <input type="hidden" name="logoPath" value={path} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type LogoFieldProps = {
  /** The org's stored logo key, `""` for none. */
  storedPath: string;
  readOnly: boolean;
  /** `prepareLogoUpload`; absent only where nothing can be picked (a read-only page). */
  prepare?: (file: LogoPicked) => Promise<LogoUploadAnswer>;
  onUploadingChange?: (uploading: boolean) => void;
  /** A field error the server returned for `logoPath`. */
  serverError?: string;
};

/**
 * Pick, upload, replace and remove the company logo. The new key is held in a hidden `logoPath` until the form is saved; the
 * caller keys this component by the stored path, so a save starts it fresh. A stored logo is drawn from its public address.
 */
export function LogoField({ storedPath, readOnly, prepare, onUploadingChange, serverError }: LogoFieldProps) {
  const [path, setPath] = useState(storedPath);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<LogoStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function pick(file: File) {
    setError(undefined);
    if (!prepare) return;
    setStatus("uploading");
    onUploadingChange?.(true);
    const result = await uploadLogo(file, { prepare, put: putToStorage });
    onUploadingChange?.(false);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setPath(result.path);
    setPreview(URL.createObjectURL(file));
    setStatus("ready");
  }

  function remove() {
    setPath("");
    setPreview(null);
    setStatus("idle");
    setError(undefined);
  }

  return (
    <LogoFieldView
      path={path}
      src={preview ?? (path === "" ? null : logoPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path))}
      status={status}
      error={error ?? serverError}
      readOnly={readOnly}
      onPick={pick}
      onRemove={remove}
    />
  );
}
