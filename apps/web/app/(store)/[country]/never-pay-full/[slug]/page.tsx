import { makeLocalizedStoreVariantPage } from "@/lib/storeVariantPage";

export const revalidate = 86400; // 24h — refreshed on-demand via /api/revalidate on admin edits

const { generateStaticParams, generateMetadata, Page } = makeLocalizedStoreVariantPage("never-pay-full");
export { generateStaticParams, generateMetadata };
export default Page;
