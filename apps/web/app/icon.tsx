import { ImageResponse } from "next/og";
import { getCachedSiteSettings } from "@/lib/data";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon mirrors the header logo mark: brand-colored rounded square (pulled
// from Site Settings so it tracks the admin's theme) with a white glyph.
export default async function Icon() {
  const settings = await getCachedSiteSettings();
  const brand = settings.themeTokens?.brandPrimary || "#7c6cf0";

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
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="7.6" r="4" fill="white" />
          <circle cx="20.4" cy="14" r="4" fill="white" />
          <circle cx="14" cy="20.4" r="4" fill="white" /><circle cx="7.6" cy="14" r="4" fill="white" /><circle cx="14" cy="14" r="2.4" fill={brand} />
        </svg>
      </div>
    ),
    { ...size }
  );
}
