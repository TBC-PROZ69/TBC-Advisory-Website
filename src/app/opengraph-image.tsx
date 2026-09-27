import { ImageResponse } from "next/og";

export const alt = "TBC Advisory — Independent counsel for HOA and COA boards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0B1C2C",
          color: "#F6F1E8",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              border: "1px solid #C4A46A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C4A46A",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            TBC
          </div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            Advisory
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 58,
              lineHeight: 1.1,
              maxWidth: 900,
              fontFamily: "Georgia, serif",
            }}
          >
            Independent counsel for HOA and COA boards
          </div>
          <div
            style={{
              width: 72,
              height: 2,
              backgroundColor: "#C4A46A",
            }}
          />
          <div style={{ fontSize: 26, color: "#F6F1E8" }}>
            Not a property management company.
          </div>
        </div>
        <div style={{ fontSize: 20, color: "#C4A46A", letterSpacing: 1 }}>
          www.tbcadvisory.com
        </div>
      </div>
    ),
    size,
  );
}
