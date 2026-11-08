import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getCachedSiteSettings, getCategoriesForNav } from "@/lib/data";

/**
 * Shared chrome for every page except the store-detail routes, which have
 * their own header/footer (see app/(store)/layout.tsx) built for the
 * store-page redesign. Route groups here are invisible in the URL — this
 * only changes which layout wraps which pages.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getCachedSiteSettings(), getCategoriesForNav()]);
  const contactEmail = settings.contact.email || "hello@monocoupon.com";

  return (
    <>
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer
        contactEmail={contactEmail}
        socialLinks={{
          facebook: settings.socialLinks.facebook,
          instagram: settings.socialLinks.instagram,
          youtube: settings.socialLinks.youtube,
          tiktok: settings.socialLinks.tiktok,
          discord: settings.socialLinks.discord,
        }}
        contact={settings.contact}
      />
    </>
  );
}
