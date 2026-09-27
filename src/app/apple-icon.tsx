import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B1C2C",
          color: "#F6F1E8",
          fontSize: 48,
          letterSpacing: 4,
          fontFamily: "Georgia, serif",
        }}
      >
        TBC
      </div>
    ),
    size,
  );
}
