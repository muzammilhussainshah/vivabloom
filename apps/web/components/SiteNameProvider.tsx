"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SITE_NAME } from "@/lib/brand";

/**
 * Makes the admin-configured site name (Site Settings -> siteName) available
 * to client components (Logo, store header/footer, ...) without threading a
 * prop through every page. Set once in the root layout.
 */
const SiteNameContext = createContext<string>(DEFAULT_SITE_NAME);

export function SiteNameProvider({ name, children }: { name: string; children: ReactNode }) {
  return <SiteNameContext.Provider value={name}>{children}</SiteNameContext.Provider>;
}

export function useSiteName(): string {
  return useContext(SiteNameContext);
}
