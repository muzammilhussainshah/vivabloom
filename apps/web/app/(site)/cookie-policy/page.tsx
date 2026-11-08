import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy", alternates: { canonical: "/cookie-policy" } };

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10 sm:px-8">
      <div>
        <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">Cookie Policy</h1>
        <p className="mt-1 text-sm text-text-muted">Last updated: July 2026</p>
      </div>

      <p className="text-text-muted">
        This Cookie Policy explains how VivaBloom, operated by Faliha Limited (Office 1877, 85 Dunstall
        Hill, Wolverhampton, United Kingdom, WV6 0SR), uses cookies and similar technologies on
        monocoupon.com.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What Are Cookies</h2>
        <p className="text-text-muted">
          Cookies are small text files stored on your device when you visit a website. They help the site
          remember information about your visit, which can make your next visit easier and the site more
          useful to you.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Types of Cookies We Use</h2>
        <ul className="list-disc pl-5 text-text-muted">
          <li>
            <span className="font-medium text-text">Essential cookies</span> — required for basic site
            functionality, such as remembering your session.
          </li>
          <li>
            <span className="font-medium text-text">Analytics cookies</span> — help us understand how visitors
            use the Site (e.g. Google Analytics) so we can improve it.
          </li>
          <li>
            <span className="font-medium text-text">Advertising cookies</span> — used to measure the
            effectiveness of ad campaigns and, where applicable, support affiliate link attribution.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Managing Cookies</h2>
        <p className="text-text-muted">
          Most browsers let you refuse or delete cookies through their settings. Blocking cookies may affect
          how parts of the Site function, such as remembering your preferences.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Changes to This Policy</h2>
        <p className="text-text-muted">
          We may update this Cookie Policy from time to time. Material changes will be reflected by updating
          the &quot;Last updated&quot; date above.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Contact Us</h2>
        <p className="text-text-muted">
          Questions about this policy? Email us at{" "}
          <a href="mailto:hello@monocoupon.com" className="text-brand-primary hover:underline">
            hello@monocoupon.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
