"use client";

/**
 * The contractor's logo in the header of a customer page (tenant-logo AC 17). The picture is the company's own, so its name is
 * the alt text; one that fails to load hides itself instead of leaving a broken-image box.
 */
const SIZES = { small: "max-h-8 max-w-24", medium: "max-h-12 max-w-40", large: "max-h-20 max-w-60" } as const;

export function TenantLogoImage({ src, name, size = "medium", centered = false }: { src: string; name: string; size?: keyof typeof SIZES; centered?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a public Storage URL of an arbitrary tenant image, drawn at its own size
    <img
      src={src}
      alt={name}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
      className={`mb-1 w-auto object-contain ${SIZES[size]} ${centered ? "self-center" : "self-start"}`}
    />
  );
}
