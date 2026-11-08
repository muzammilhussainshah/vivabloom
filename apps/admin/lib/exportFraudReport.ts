import { connectToDatabase, TrackingEvent, EngagementEvent } from "@monocoupon/db";
import {
  buildRiskContext,
  scoreSession,
  getFingerprintAssociates,
  type RiskResult,
  type FingerprintAssociate,
} from "@/lib/fraudSignals";

const RISK_WINDOW_DAYS = 30;

export interface FraudReportSession {
  sessionId: string;
  at: Date | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  gclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  risk: RiskResult;
  fingerprintId: string | null;
  /** Only populated when the session was flagged fp_reset — the cookie identities/IPs behind that one device. */
  fingerprintAssociates: FingerprintAssociate[] | null;
}

/**
 * Gathers everything needed to write up an invalid-click report for a set
 * of admin-selected sessions: risk score + reasons, ad attribution (gclid/
 * utm), and — for fingerprint-reset sessions — the concrete cookie
 * identities/IPs proving deliberate evasion. One shared risk context is
 * built for the whole batch rather than per session.
 */
export async function getFraudReportData(sessionIds: string[]): Promise<FraudReportSession[]> {
  await connectToDatabase();
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const riskWindowStart = new Date(Date.now() - RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const riskContext = await buildRiskContext(riskWindowStart);

  const [pageviews, engagements] = await Promise.all([
    TrackingEvent.find({ sessionId: { $in: ids } }).sort({ createdAt: 1 }).lean(),
    EngagementEvent.find({ sessionId: { $in: ids } }).sort({ createdAt: 1 }).lean(),
  ]);

  const pvBySession = new Map<string, typeof pageviews>();
  for (const pv of pageviews) {
    const list = pvBySession.get(pv.sessionId) ?? [];
    list.push(pv);
    pvBySession.set(pv.sessionId, list);
  }
  const enBySession = new Map<string, typeof engagements>();
  for (const en of engagements) {
    const list = enBySession.get(en.sessionId) ?? [];
    list.push(en);
    enBySession.set(en.sessionId, list);
  }

  const results: FraudReportSession[] = [];
  for (const sessionId of ids) {
    const pvs = pvBySession.get(sessionId) ?? [];
    if (pvs.length === 0) continue;
    const first = pvs[0];
    const risk = scoreSession(pvs, enBySession.get(sessionId) ?? [], riskContext);

    // Ad attribution can land on a later pageview if the first beacon was lost.
    const adSource = pvs.find((p) => p.gclid || p.utm?.source) ?? first;

    const fingerprintAssociates =
      first.fingerprintId && risk.flags.some((f) => f.code === "fp_reset")
        ? await getFingerprintAssociates(first.fingerprintId, riskWindowStart)
        : null;

    results.push({
      sessionId,
      at: first.createdAt ?? null,
      ip: first.ip ?? null,
      country: first.country ?? null,
      region: first.region ?? null,
      city: first.city ?? null,
      gclid: adSource.gclid ?? null,
      utmSource: adSource.utm?.source ?? null,
      utmMedium: adSource.utm?.medium ?? null,
      utmCampaign: adSource.utm?.campaign ?? null,
      utmTerm: adSource.utm?.term ?? null,
      risk,
      fingerprintId: first.fingerprintId ?? null,
      fingerprintAssociates,
    });
  }

  // Worst-first, same ordering convention as the Suspicious tab.
  return results.sort((a, b) => b.risk.score - a.risk.score);
}
