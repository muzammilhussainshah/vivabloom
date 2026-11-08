import { makeLocalizedStoreVariantPage } from "@/lib/storeVariantPage";

export const revalidate = 86400; // 24h — refreshed on-demand via /api/revalidate on admin edits

const { generateStaticParams, generateMetadata, Page } = makeLocalizedStoreVariantPage("secret-codes");
export { generateStaticParams, generateMetadata };
export default Page;
