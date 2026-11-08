import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import { getCachedSiteSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Contact Us", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const settings = await getCachedSiteSettings();
  const contactEmail = settings.contact.email || "hello@monocoupon.com";
  const hasSocial =
    settings.socialLinks.facebook ||
    settings.socialLinks.instagram ||
    settings.socialLinks.youtube ||
    settings.socialLinks.tiktok ||
    settings.socialLinks.discord;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-5 py-10 sm:flex-row sm:gap-12 sm:px-8">
      <section className="flex flex-1 flex-col gap-4">
        <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">Contact Us</h1>
        <p className="text-text-muted">Have a question, found an expired code, or want to suggest a store? Let us know.</p>
        <ContactForm />
      </section>

      <section className="flex w-full flex-col gap-4 sm:w-64">
        <div>
          <h2 className="text-sm font-semibold">Contact Information</h2>
          <p className="mt-1 text-sm text-text-muted">Faliha Limited (operating VivaBloom)</p>
          <a href={`mailto:${contactEmail}`} className="mt-1 block text-sm text-brand-primary hover:underline">
            {contactEmail}
          </a>
          {settings.contact.phone && <p className="mt-1 text-sm text-text-muted">{settings.contact.phone}</p>}
          {settings.contact.address && <p className="mt-1 text-sm text-text-muted">{settings.contact.address}</p>}
        </div>
        <div>
          <h2 className="text-sm font-semibold">Follow Us</h2>
          {hasSocial ? (
            <div className="mt-1 flex flex-col gap-1">
              {settings.socialLinks.facebook && (
                <a href={settings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
                  Facebook
                </a>
              )}
              {settings.socialLinks.instagram && (
                <a href={settings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
                  Instagram
                </a>
              )}
              {settings.socialLinks.youtube && (
                <a href={settings.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
                  YouTube
                </a>
              )}
              {settings.socialLinks.tiktok && (
                <a href={settings.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
                  TikTok
                </a>
              )}
              {settings.socialLinks.discord && (
                <a href={settings.socialLinks.discord} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline">
                  Discord
                </a>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-text-muted">Social links coming soon.</p>
          )}
        </div>
      </section>
    </div>
  );
}
