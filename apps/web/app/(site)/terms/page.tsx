import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getCachedSiteSettings } from "@/lib/data";
import { resolveSiteName } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/terms" } };

export default async function TermsPage() {
  const siteName = resolveSiteName((await getCachedSiteSettings()).siteName);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10 sm:px-8 sm:py-14">
      <PageHeader eyebrow="Legal" title="Terms of Service" meta="Last updated: July 2026" />

      <p className="text-text-muted">
        By accessing or using monocoupon.com (the &quot;Site&quot;), you agree to these Terms of Service. If you
        do not agree, please do not use the Site.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Legal Entity</h2>
        <p className="text-text-muted">
          {siteName} is operated by AppMash Limited, a UK-based software solutions company, registered
          office at Office 875, 55 Gracechurch Street, London, United Kingdom, EC3V 0HR. References to
          &quot;{siteName}&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot; in these Terms mean AppMash Limited.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Use of the Site</h2>
        <p className="text-text-muted">
          {siteName} provides a free directory of coupon codes, deals, and related shopping content. You may
          browse and use the Site for personal, non-commercial purposes. You agree not to misuse the Site,
          including attempting to scrape, disrupt, or gain unauthorized access to it.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Coupon &amp; Deal Accuracy</h2>
        <p className="text-text-muted">
          We make reasonable efforts to keep coupon codes and deals accurate and up to date, and we mark
          verified codes with the date they were last checked. However, retailers can change or end offers at
          any time without notice. We do not guarantee that any code or deal will work, and we are not
          responsible for expired or invalid offers.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Affiliate Relationships</h2>
        <p className="text-text-muted">
          {siteName} may participate in affiliate programs and earn a commission when you make a purchase
          through links on the Site, at no extra cost to you. See our Privacy Policy for more detail.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Intellectual Property</h2>
        <p className="text-text-muted">
          The Site&apos;s design, layout, and original written content are owned by {siteName}. Store names,
          logos, and trademarks referenced on the Site belong to their respective owners and are used for
          identification purposes only.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Third-Party Websites</h2>
        <p className="text-text-muted">
          The Site links to third-party retailer websites we do not control. We are not responsible for the
          content, products, services, or practices of those sites.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Limitation of Liability</h2>
        <p className="text-text-muted">
          The Site is provided &quot;as is&quot; without warranties of any kind. To the fullest extent permitted
          by law, {siteName} is not liable for any indirect, incidental, or consequential damages arising from
          your use of the Site or reliance on any coupon or deal listed on it.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Changes to These Terms</h2>
        <p className="text-text-muted">
          We may update these Terms from time to time. Continued use of the Site after changes are posted
          constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Contact Us</h2>
        <p className="text-text-muted">
          Questions about these Terms? Email us at{" "}
          <a href="mailto:vivabloom2@gmail.com" className="text-brand-primary hover:underline">
            vivabloom2@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
