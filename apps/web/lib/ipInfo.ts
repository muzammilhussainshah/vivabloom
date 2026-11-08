// ASN/organization lookup for visitor IPs via ipinfo.io (free tier:
// 50k req/month). Optional — without IPINFO_TOKEN every call resolves to
// null and nothing else changes. Results are cached in-memory per instance
// so repeat visitors cost nothing.

const HOSTING_ORG_RE =
  /amazon|aws|google llc|google cloud|gcp|microsoft|azure|hetzner|ovh|digitalocean|linode|akamai|vultr|oracle|alibaba|tencent|leaseweb|contabo|m247|datacamp|choopa|colocrossing|colo\b|hosting|server|servers|vps|dedicated|datacenter|data center/i;

const PRIVATE_IP_RE = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i;

export interface IpInfoResult {
  org: string | null;
  hosting: boolean;
}

const cache = new Map<string, IpInfoResult>();
const CACHE_MAX = 5000;

export async function lookupIp(ip: string | null): Promise<IpInfoResult | null> {
  const token = process.env.IPINFO_TOKEN;
  if (!token || !ip || PRIVATE_IP_RE.test(ip)) return null;

  const cached = cache.get(ip);
  if (cached) return cached;

  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${token}`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { org?: string; privacy?: { hosting?: boolean } };
    const org = data.org ?? null;
    const result: IpInfoResult = {
      org,
      hosting: data.privacy?.hosting === true || (!!org && HOSTING_ORG_RE.test(org)),
    };
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(ip, result);
    return result;
  } catch {
    // Beacon path — a failed lookup must never surface or delay anything.
    return null;
  }
}
