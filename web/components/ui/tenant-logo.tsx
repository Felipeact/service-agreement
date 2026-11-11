"use client";

/**
 * The contractor's logo in the header of a customer page (tenant-logo AC 17). The picture is the company's own, so its name is
 * the alt text; one that fails to load hides itself instead of leaving a broken-image box.
 */
export function TenantLogoImage({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a public Storage URL of an arbitrary tenant image, drawn at its own size
    <img
      src={src}
      alt={name}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
      className="mb-1 max-h-12 w-auto max-w-40 self-start object-contain"
    />
  );
}
