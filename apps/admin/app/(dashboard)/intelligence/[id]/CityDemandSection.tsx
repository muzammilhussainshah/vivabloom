import { getResearchCountry } from "@monocoupon/validation";
import { googleAdsConfig, missingGoogleAdsSettings } from "@/lib/intelligence/googleAds";
import type { CityDemandRow, StoreCheckView } from "@/lib/intelligence/types";
import { CityDemandButton } from "@/components/intelligence/CityDemandButton";
import { Card, SectionHeader, timeAgo } from "@/components/intelligence/ui";

const nf = new Intl.NumberFormat("en-US");
const KIND_LABEL: Record<CityDemandRow["kind"], string> = { brand: "Brand", coupon: "Brand + coupon", product: "Product" };

function heat(value: number | null, max: number): string {
  if (value == null || max <= 0) return "";
  const r = value / max;
  return r >= 0.75 ? "bg-brand-primary/25 font-semibold text-text" : r >= 0.5 ? "bg-brand-primary/15" : r >= 0.25 ? "bg-brand-primary/[0.07]" : "";
}

/** Where people search for the brand, its coupon keywords and its top products — city by city (Google Ads Keyword Planner). */
export function CityDemandSection({ check }: { check: StoreCheckView }) {
  const d = check.cityDemand;
  const connected = Boolean(googleAdsConfig());
  const market = getResearchCountry(d?.market ?? check.targetCountry)?.name ?? "United States";

  return (
    <Card id="cities">
      <SectionHeader
        title="City demand"
        description={`Monthly Google searches per city in ${market}, from your own Google Ads Keyword Planner — where people look for this brand, its coupons and its top products. It is search demand, not the store's sales (no public source has those).`}
        aside={d && connected ? <CityDemandButton checkId={check.id} refresh /> : undefined}
      />
      {!connected ? (
        <SetupCard />
      ) : !d ? (
        <div className="flex flex-col gap-3 px-5 py-6 md:px-6">
          <p className="max-w-2xl text-sm text-text-muted">
            Asks Google Ads for the brand, “{(check.identity?.name ?? check.name ?? check.domain).toLowerCase()} coupon / promo code / discount code” and the top products, in the country and its biggest
            cities. Takes about 15 seconds; uses no web-search credits.
          </p>
          <CityDemandButton checkId={check.id} />
        </div>
      ) : (
        <CityTable data={d} />
      )}
    </Card>
  );
}

function CityTable({ data }: { data: NonNullable<StoreCheckView["cityDemand"]> }) {
  const coupon = data.rows.filter((r) => r.kind === "coupon");
  const brand = data.rows.find((r) => r.kind === "brand");
  const intentRows = coupon.some((r) => Object.values(r.byCity).some((v) => v)) ? coupon : brand ? [brand] : [];
  const cityScore = (id: string) => intentRows.reduce((n, r) => n + (r.byCity[id] ?? 0), 0);
  const cities = [...data.cities].sort((a, b) => cityScore(b.id) - cityScore(a.id) || (brand?.byCity[b.id] ?? 0) - (brand?.byCity[a.id] ?? 0));
  const best = cities.filter((c) => cityScore(c.id) > 0).slice(0, 5);
  const noData = data.rows.every((r) => r.national == null && Object.values(r.byCity).every((v) => v == null));

  if (data.cities.length === 0) {
    return <p className="px-5 py-6 text-sm text-text-muted md:px-6">Google Ads returned no city targets for this market.</p>;
  }
  if (noData) {
    return <p className="px-5 py-6 text-sm text-text-muted md:px-6">Google has too few searches to report for this brand and its products in this market — a sign the brand is still small here.</p>;
  }

  return (
    <div className="flex flex-col">
      {best.length > 0 && (
        <div className="border-b border-border px-5 py-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            Best cities for your {intentRows === coupon ? "brand + coupon" : "brand"} ads
          </p>
          <ol className="mt-2 flex flex-wrap gap-2">
            {best.map((c, i) => (
              <li key={c.id} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/10 text-[11px] font-bold text-brand-primary">{i + 1}</span>
                <span className="font-semibold text-text">{c.name}</span>
                <span className="tabular-nums text-text-muted">{nf.format(cityScore(c.id))}/mo</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/70 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              <th className="sticky left-0 z-10 min-w-[240px] bg-surface px-5 py-2.5 md:px-6">Keyword</th>
              <th className="px-3 py-2.5 text-right">Whole country</th>
              <th className="px-3 py-2.5 text-right" title="Top-of-page bid range in your Ads account currency">CPC range</th>
              {cities.map((c) => (
                <th key={c.id} className="whitespace-nowrap px-3 py-2.5 text-right">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((r) => {
              const values = cities.map((c) => r.byCity[c.id] ?? null);
              const max = Math.max(0, ...values.map((v) => v ?? 0));
              const top = max > 0 ? cities[values.indexOf(max)] : null;
              return (
                <tr key={r.keyword} className="align-top">
                  <td className="sticky left-0 z-10 bg-white px-5 py-3 md:px-6">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{KIND_LABEL[r.kind]}</p>
                    <p className="font-medium text-text">{r.kind === "product" && r.product ? r.product : r.keyword}</p>
                    {r.kind === "product" && <p className="text-xs text-text-muted">searched as “{r.keyword}”</p>}
                    {top && <p className="mt-0.5 text-xs font-semibold text-brand-primary">Most searched in {top.name}</p>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-text">{r.national != null ? nf.format(r.national) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-muted">
                    {r.bidLow != null || r.bidHigh != null ? `${r.bidLow?.toFixed(2) ?? "?"}–${r.bidHigh?.toFixed(2) ?? "?"}` : "—"}
                  </td>
                  {values.map((v, i) => (
                    <td key={cities[i]!.id} className={`px-3 py-3 text-right tabular-nums ${heat(v, max)}`}>
                      {v != null ? nf.format(v) : <span className="text-text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-5 py-3 text-xs text-text-muted md:px-6">
        Average monthly Google searches over the last 12 months · “—” = too few searches for Google to report · darker cells = the city with most searches for that keyword · CPC in your
        Google Ads account currency · loaded {timeAgo(data.checkedAt)}.
      </p>
    </div>
  );
}

function SetupCard() {
  const missing = missingGoogleAdsSettings();
  return (
    <div className="flex flex-col gap-4 px-5 py-6 md:px-6" data-print-hide>
      <p className="max-w-2xl text-sm text-text">
        Connect your Google Ads account once to see, for every store, which cities search most for its brand, its coupons and its products — the same data Keyword Planner shows you, free.
      </p>
      <ol className="flex max-w-3xl flex-col gap-3 text-sm text-text">
        {[
          ["Developer token", "In Google Ads open Tools → Setup → API Center and copy the developer token. Real numbers need “Basic access” — apply there if it says Test or Explorer access."],
          ["OAuth client", "In Google Cloud Console create a project, enable “Google Ads API”, then create an OAuth client ID (type: Desktop app). Copy its client ID and secret."],
          ["Refresh token", "Open the OAuth 2.0 Playground, tick “Use your own OAuth credentials”, paste the client ID/secret, authorise the scope https://www.googleapis.com/auth/adwords with the Google account that owns your Ads account, and exchange the code for a refresh token."],
          ["Customer ID", "Your Google Ads account number (top right in Google Ads, like 123-456-7890). If you sign in through a manager (MCC) account, also note the manager's number."],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">{i + 1}</span>
            <span>
              <span className="font-semibold">{title}.</span> <span className="text-text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="max-w-3xl rounded-xl border border-border bg-surface/60 p-4">
        <p className="text-xs font-semibold text-text-muted">Add these to apps/admin/.env.local (and to Vercel), then restart:</p>
        <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-text">
          {["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_LOGIN_CUSTOMER_ID   # only with a manager (MCC) account"]
            .map((k) => `${k}=${missing.includes(k.split(" ")[0]!) ? "   ← missing" : ""}`)
            .join("\n")}
        </pre>
      </div>
    </div>
  );
}
