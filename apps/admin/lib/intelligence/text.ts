/**
 * Cleans AI/page text for display: the model sometimes keeps markdown from the
 * source ("**10% commission**", "[Become an Affiliate](url)"). Shows the words only.
 */
export function cleanText(input: string): string {
  return input
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/\*\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
