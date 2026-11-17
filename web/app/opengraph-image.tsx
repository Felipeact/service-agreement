import { ImageResponse } from "next/og";

export const alt = "Service Pacts: from service list to signed agreement.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card every public page inherits: the name and the promise on the brand's night blue. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: "#0f1c2e", color: "#ffffff" }}>
        <div style={{ fontSize: 40, color: "#b4c0d0" }}>Service Pacts</div>
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>From service list to signed agreement.</div>
        <div style={{ fontSize: 34, color: "#b4c0d0", marginTop: 32 }}>Recurring service agreements for trade contractors.</div>
      </div>
    ),
    size,
  );
}
