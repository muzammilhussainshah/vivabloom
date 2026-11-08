/** Darkens a #rrggbb hex color by the given fraction (0.15 = 15% darker). */
export function darkenHex(hex: string, amount: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return hex;

  const num = parseInt(match[1], 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
