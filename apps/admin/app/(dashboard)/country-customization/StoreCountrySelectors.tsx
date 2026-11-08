"use client";

import { useRouter, usePathname } from "next/navigation";

export interface StoreOption {
  id: string;
  name: string;
}

export interface CountryOption {
  code: string;
  countryName: string;
}

/**
 * The two dropdowns that drive this whole page — selecting a store or
 * language navigates to `?store={id}&country={code}` so the actual content
 * (CountryCustomizationForm) stays server-rendered per selection, same
 * pattern as every other admin page in this app, rather than fetching
 * client-side.
 */
export function StoreCountrySelectors({
  stores,
  countries,
  currentStore,
  currentCountry,
}: {
  stores: StoreOption[];
  countries: CountryOption[];
  currentStore: string;
  currentCountry: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(store: string, country: string) {
    const params = new URLSearchParams();
    if (store) params.set("store", store);
    if (country) params.set("country", country);
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Store</label>
        <select
          value={currentStore}
          onChange={(e) => navigate(e.target.value, currentCountry)}
          className="min-w-56 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="">Select a store…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Language</label>
        <select
          value={currentCountry}
          onChange={(e) => navigate(currentStore, e.target.value)}
          className="min-w-56 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="">Select a language…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.countryName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
