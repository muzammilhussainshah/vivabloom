import { StatTile } from "@/components/analytics/StatTile";
import { EventTypeBadge } from "@/components/analytics/EventTypeBadge";
import { CopyableList } from "@/components/analytics/CopyableList";
import type { SessionJourneyData } from "./getSessionJourney";

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatEngagementValue(type: string, value: number | null | undefined) {
  if (value == null) return null;
  if (type === "dwell") return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
  if (type === "scroll_depth") return `${value}%`;
  return String(value);
}

/** Shared body for both the full /analytics/sessions/[sessionId] page and its slide-over modal counterpart — stat tiles + the event timeline. */
export function SessionJourneyContent({
  sessionId,
  pageviewCount,
  engagementCount,
  duration,
  deviceId,
  fingerprintId,
  timeline,
  summary,
  risk,
  suspectIp,
  fingerprintAssociates,
  ad,
}: { sessionId: string } & SessionJourneyData) {
  const verdict =
    risk.level === "high"
      ? { bg: "color-mix(in srgb, #dc2626 8%, var(--surface))", border: "#dc2626", color: "#dc2626", title: "High risk — likely bot, competitor, or click fraud" }
      : risk.level === "medium"
        ? { bg: "color-mix(in srgb, #d97706 8%, var(--surface))", border: "#d97706", color: "#d97706", title: "Medium risk — some suspicious signals" }
        : { bg: "var(--surface)", border: "var(--border)", color: "var(--brand-accent)", title: "Looks legitimate — no red flags" };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Session journey</h1>
        <p className="font-mono text-sm text-text-muted">{sessionId}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatTile label="Page views" value={String(pageviewCount)} />
        <StatTile label="Session duration" value={duration} />
        <StatTile label="Engagement events" value={String(engagementCount)} />
        <StatTile label="Device ID" value={deviceId} />
        <StatTile label="Fingerprint ID" value={fingerprintId} hint="Survives cookie clearing" />
      </div>

      {ad && (
        <div className="rounded-base border border-border bg-surface p-5">
          <p className="mb-3 text-xs font-medium text-text-muted">Ad attribution</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {ad.term && (
              <>
                <dt className="text-text-muted">Keyword</dt>
                <dd className="font-medium">{ad.term}</dd>
              </>
            )}
            {ad.campaign && (
              <>
                <dt className="text-text-muted">Campaign</dt>
                <dd className="font-mono text-xs">{ad.campaign}</dd>
              </>
            )}
            {(ad.source || ad.medium) && (
              <>
                <dt className="text-text-muted">Source</dt>
                <dd>{[ad.source, ad.medium].filter(Boolean).join(" / ")}</dd>
              </>
            )}
            {ad.content && (
              <>
                <dt className="text-text-muted">Ad / creative</dt>
                <dd className="font-mono text-xs">{ad.content}</dd>
              </>
            )}
          </dl>
          {ad.gclid && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-text-muted">
                Google click ID (gclid) — proof this visit was a paid click; needed when filing an invalid-click claim with Google.
              </p>
              <CopyableList values={[ad.gclid]} emptyLabel="" />
            </div>
          )}
        </div>
      )}

      <div className="rounded-base border border-border bg-surface p-5">
        <p className="mb-4 text-xs font-medium text-text-muted">Journey</p>
        {timeline.length === 0 ? (
          <p className="text-sm text-text-muted">No events found for this session.</p>
        ) : (
          <ol className="flex flex-col">
            {timeline.map((item, i) => {
              const isLast = i === timeline.length - 1;
              const dotColor = item.kind === "pageview" ? "var(--brand-primary)" : "var(--text-muted)";
              return (
                <li key={i} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface"
                      style={{ backgroundColor: dotColor }}
                    />
                    {!isLast && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className={`flex flex-1 flex-wrap items-center gap-2 text-sm ${isLast ? "pb-0" : "pb-5"}`}>
                    <span className="whitespace-nowrap text-xs text-text-muted">{formatTime(item.at)}</span>
                    {item.kind === "pageview" ? (
                      <>
                        <span className="font-mono text-xs font-medium">{item.path}</span>
                        {item.referrer && (
                          <span className="text-xs text-text-muted">from {item.referrer}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <EventTypeBadge type={item.type} />
                        <span className="font-mono text-xs text-text-muted">{item.path}</span>
                        {formatEngagementValue(item.type, item.value) && (
                          <span className="text-xs font-medium tabular-nums">{formatEngagementValue(item.type, item.value)}</span>
                        )}
                        {(item.couponTitle || item.couponCode) && (
                          <span className="text-xs text-text-muted">
                            {[item.storeSlug, item.couponTitle ?? item.couponCode].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {summary.length > 0 && (
        <div className="rounded-base border border-border bg-surface p-5">
          <p className="mb-3 text-xs font-medium text-text-muted">Summary</p>
          <ul className="flex flex-col gap-2 text-sm">
            {summary.map((line, i) => (
              <li key={i} className="text-text">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk verdict — always last, so it's the takeaway after reading the flow. */}
      <div className="rounded-base border p-5" style={{ backgroundColor: verdict.bg, borderColor: verdict.border }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: verdict.color }}>
            {verdict.title}
          </span>
          {risk.level !== "low" && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${verdict.border} 16%, var(--surface-muted))`, color: verdict.color }}
            >
              risk score {risk.score}
            </span>
          )}
        </div>

        {risk.flags.length > 0 ? (
          <>
            <p className="mt-3 text-xs font-medium text-text-muted">Why this session was flagged:</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {risk.flags.map((f) => (
                <li key={f.code} className="flex gap-2">
                  <span aria-hidden="true" style={{ color: verdict.color }}>
                    •
                  </span>
                  <span>
                    <span className="font-medium">{f.label}.</span> <span className="text-text-muted">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {suspectIp && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium text-text-muted">Block this IP in your Google Ads campaign:</p>
                <CopyableList values={[suspectIp]} emptyLabel="No IP recorded for this session." />
              </div>
            )}

            {fingerprintAssociates && fingerprintAssociates.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium text-text-muted">
                  Cookie identities behind this fingerprint — one machine posing as {fingerprintAssociates.length} separate visitors:
                </p>
                <div className="mb-3 overflow-x-auto rounded-base border border-border">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border bg-surface-muted text-left">
                      <tr>
                        <th className="p-2">Device ID</th>
                        <th className="p-2">IP(s)</th>
                        <th className="p-2">Sessions</th>
                        <th className="p-2">Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fingerprintAssociates.map((a) => (
                        <tr key={a.deviceId} className="border-b border-border last:border-0">
                          <td className="p-2 font-mono">{a.deviceId.slice(0, 8)}</td>
                          <td className="p-2 font-mono">{a.ips.length > 0 ? a.ips.join(", ") : "—"}</td>
                          <td className="p-2 tabular-nums">{a.sessionCount}</td>
                          <td className="p-2 whitespace-nowrap text-text-muted">{new Date(a.lastSeen).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mb-1 text-xs font-medium text-text-muted">Block all of this fingerprint&rsquo;s IPs in Google Ads:</p>
                <CopyableList
                  values={Array.from(new Set(fingerprintAssociates.flatMap((a) => a.ips)))}
                  emptyLabel="No IPs recorded for these identities."
                />
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            This session shows normal visitor behavior — no bot, fraud, or competitor signals were detected.
          </p>
        )}
      </div>
    </div>
  );
}
