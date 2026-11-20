/** Fallback brand name when the admin's Site Settings "siteName" is empty. */
export const DEFAULT_SITE_NAME = "VivaBloom";

export function resolveSiteName(name: string | null | undefined): string {
  return name?.trim() || DEFAULT_SITE_NAME;
}

/**
 * Splits the site name into the two halves of the two-tone wordmark:
 * "Value Version" -> ["Value", " Version"], "VivaBloom" -> ["Viva", "Bloom"]
 * (camel-case boundary), single word -> [name, ""].
 */
export function splitWordmark(name: string): [string, string] {
  const space = name.indexOf(" ");
  if (space > 0) return [name.slice(0, space), name.slice(space)];
  const camel = name.slice(1).search(/[A-Z]/);
  if (camel >= 0) return [name.slice(0, camel + 1), name.slice(camel + 1)];
  return [name, ""];
}

/**
 * Blog posts store an `author` string, and every post created before the
 * rename was saved with the old default "VivaBloom". Treat that legacy
 * default (or a blank author) as "the site itself" so it always shows the
 * current admin-configured site name; a real person's name passes through.
 */
export function displayAuthor(author: string | null | undefined, siteName: string): string {
  const a = author?.trim();
  return !a || a.toLowerCase() === DEFAULT_SITE_NAME.toLowerCase() ? siteName : a;
}
