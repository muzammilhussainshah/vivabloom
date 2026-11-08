import { makeLocalizedStoreVariantPage } from "@/lib/storeVariantPage";

export const revalidate = 86400; // 24h — refreshed on-demand via /api/revalidate on admin edits

const { generateStaticParams, generateMetadata, Page } = makeLocalizedStoreVariantPage("free-shipping-codes");
export { generateStaticParams, generateMetadata };
export default Page;
