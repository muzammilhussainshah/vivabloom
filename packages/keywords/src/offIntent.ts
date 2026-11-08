import type { KeywordRecord } from "./generate";

/**
 * Negatives for the one gap no template line can ever create: a bare "{brand}",
 * "{brand} {descriptor}", or "{descriptor}" query, with no coupon/discount word
 * at all. Every positive this tool generates always pairs the brand with an
 * intent term (see `generate.ts`/`generateLocale.ts`), so a search that is
 * *just* these words carries no discount intent — it's someone researching the
 * product, not looking for a code.
 *
 * Exact match is deliberate and load-bearing here, not a stylistic choice: it
 * blocks the bare query but can never touch a longer discount-intent keyword,
 * since exact match does not extend to a query with extra words. That's what
 * keeps this safe to run unconditionally alongside the rest of the negative
 * list without risking the campaign's own positives.
 */
export function generateOffIntentNegativeRecords(targetNames: string[], descriptors: string[]): KeywordRecord[] {
  const seen = new Set<string>();
  const output: KeywordRecord[] = [];
  let sourceIndex = 0;

  const emit = (text: string, nameVariant: string, nameVariantIndex: number, descriptor: string, descriptorIndex: number) => {
    const tidied = text.replace(/\s+/g, " ").trim();
    if (!tidied) return;
    const keyword = `[${tidied}]`;
    const key = keyword.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push({
      keyword,
      sourceIndex: sourceIndex++,
      locale: "",
      nameVariant,
      nameVariantIndex,
      descriptor,
      descriptorIndex,
    });
  };

  targetNames.forEach((name, nameVariantIndex) => {
    emit(name, name, nameVariantIndex, "", 0);
    descriptors.forEach((descriptor, descriptorIndex) => {
      emit(`${name} ${descriptor}`, name, nameVariantIndex, descriptor, descriptorIndex);
    });
  });

  descriptors.forEach((descriptor, descriptorIndex) => {
    emit(descriptor, "", 0, descriptor, descriptorIndex);
  });

  return output;
}
