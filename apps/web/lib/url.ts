/** Re-serializes a Next.js `searchParams` object back into a `?a=b&c=d` string, preserving multi-value keys. */
export function toQueryString(searchParams: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.append(key, value);
    }
  }
  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
}
