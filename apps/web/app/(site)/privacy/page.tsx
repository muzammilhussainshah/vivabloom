import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10 sm:px-8">
      <div>
        <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">Privacy Policy</h1>
        <p className="mt-1 text-sm text-text-muted">Last updated: July 2026</p>
      </div>

      <p className="text-text-muted">
        This Privacy Policy explains how VivaBloom (&quot;we&quot;, &quot;us&quot;) collects, uses, and protects
        information when you use monocoupon.com (the &quot;Site&quot;).
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Legal Entity</h2>
        <p className="text-text-muted">
          VivaBloom is operated by Faliha Limited, a UK-based software solutions company, registered
          office at Office 1877, 85 Dunstall Hill, Wolverhampton, United Kingdom, WV6 0SR. Faliha Limited is
          the data controller for personal information collected through the Site.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Information We Collect</h2>
        <p className="text-text-muted">
          We collect information you provide directly, such as your email address when you subscribe to our
          newsletter or submit the contact form. We also automatically collect certain technical information —
          including your IP address (stored in hashed form, never in plain text), browser type, device type,
          approximate location (country-level), pages visited, and referring links — through cookies and
          similar technologies described in our Cookie Policy.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">How We Use Information</h2>
        <ul className="list-disc pl-5 text-text-muted">
          <li>To operate and improve the Site, including showing which coupons are popular or working.</li>
          <li>To send newsletter emails to subscribers who opted in, and to respond to contact form messages.</li>
          <li>To measure aggregate traffic and campaign performance through analytics tools.</li>
          <li>To detect and prevent abuse, fraud, or misuse of the Site.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Affiliate Links &amp; Advertising Disclosure</h2>
        <p className="text-text-muted">
          Some links on VivaBloom are affiliate links. If you click through and make a purchase, we may earn a
          commission from the retailer at no additional cost to you. This does not influence which coupons we
          list or how we describe them.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Third-Party Links</h2>
        <p className="text-text-muted">
          The Site links to third-party retailer websites. We are not responsible for the privacy practices or
          content of those sites. We encourage you to review their privacy policies before providing any
          personal information.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Data Sharing</h2>
        <p className="text-text-muted">
          We do not sell your personal information. We may share information with service providers who help us
          operate the Site (such as hosting, analytics, and email delivery providers), each bound to use it only
          for the services they provide us.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Your Choices</h2>
        <p className="text-text-muted">
          You can unsubscribe from our newsletter at any time using the link in any email we send. You can also
          control cookies through your browser settings, as described in our Cookie Policy.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Children&apos;s Privacy</h2>
        <p className="text-text-muted">
          The Site is not directed at children under 13, and we do not knowingly collect personal information
          from children.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Changes to This Policy</h2>
        <p className="text-text-muted">
          We may update this Privacy Policy from time to time. Material changes will be reflected by updating
          the &quot;Last updated&quot; date above.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Contact Us</h2>
        <p className="text-text-muted">
          Questions about this policy? Email us at{" "}
          <a href="mailto:hello@monocoupon.com" className="text-brand-primary hover:underline">
            hello@monocoupon.com
          </a>{" "}
          or write to us at Faliha Limited, Office 1877, 85 Dunstall Hill, Wolverhampton, United Kingdom,
          WV6 0SR.
        </p>
      </section>
    </div>
  );
}
