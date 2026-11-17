import { ImageResponse } from "next/og";
import { getCachedSiteSettings } from "@/lib/data";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon mirrors the header logo mark: the lotus bloom in white on a
// brand-colored rounded square (pulled from Site Settings so it tracks the
// admin's theme). Same petal geometry as components/Logo.tsx.
const PETAL = "M16 4.5C19.7 8.7 20.5 14.6 16 21.5C11.5 14.6 12.3 8.7 16 4.5Z";
const OUTER = (angle: number) => `rotate(${angle} 16 21.5) translate(16 21.5) scale(0.7) translate(-16 -21.5)`;

export default async function Icon() {
  const settings = await getCachedSiteSettings();
  const brand = settings.themeTokens?.brandPrimary || "#1f6f5c";

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: brand,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <path d={PETAL} transform={OUTER(-74)} fill="white" fillOpacity="0.55" />
          <path d={PETAL} transform={OUTER(74)} fill="white" fillOpacity="0.55" />
          <path d={PETAL} transform="rotate(-38 16 21.5)" fill="white" fillOpacity="0.8" stroke={brand} strokeWidth="1.1" />
          <path d={PETAL} transform="rotate(38 16 21.5)" fill="white" fillOpacity="0.8" stroke={brand} strokeWidth="1.1" />
          <path d={PETAL} fill="white" stroke={brand} strokeWidth="1.1" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
