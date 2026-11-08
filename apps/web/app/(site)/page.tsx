import { getBlogHomeData, getCachedSiteSettings } from "@/lib/data";
import { FeaturedHero, withLineBreaks } from "@/components/FeaturedHero";
import { MostReadBand } from "@/components/MostReadBand";
import { CategorySpotlight } from "@/components/CategorySpotlight";
import { CategoryMosaic } from "@/components/CategoryMosaic";
import { LoadMoreArticles } from "@/components/LoadMoreArticles";
import { NewsletterCta } from "@/components/NewsletterCta";

export const revalidate = 300;

const HERO_DEFAULTS = {
  overline: "Insights that matter, stories that inspire",
  heading: "Read. Learn. Grow.",
  description:
    "Discover powerful ideas, practical tips, and real-world knowledge across tech, business, lifestyle, and more. Stay updated, stay ahead.",
};

/** Kicker label + serif title + a short relevant description of the section — replaces the old icon-before-heading pattern for a quieter, more editorial section header. */
function Kicker({ label, title, subtitle }: { label: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="w-fit rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">{label}</span>
      <h2 className="font-serif text-3xl font-bold sm:text-4xl">{title}</h2>
      <p className="max-w-xl text-sm text-text-muted">{subtitle}</p>
    </div>
  );
}

export default async function Home() {
  const [home, settings] = await Promise.all([getBlogHomeData(), getCachedSiteSettings()]);
  const { featuredPost, latestPosts, mostReadPosts, categorySections, browseCategories, initialPosts, totalPosts } =
    home;

  const heroOverline = settings.heroOverline?.trim() || HERO_DEFAULTS.overline;
  const heroHeading = settings.tagline?.trim() || HERO_DEFAULTS.heading;
  const heroDescription = settings.heroDescription?.trim() || HERO_DEFAULTS.description;

  return (
    <div className="flex flex-col">
      <FeaturedHero
        post={featuredPost}
        nextUp={latestPosts}
        fallback={{
          overline: heroOverline,
          heading: withLineBreaks(heroHeading),
          description: withLineBreaks(heroDescription),
          heroImage: settings.heroImage,
        }}
      />

      {/* Most Read — full-bleed band */}
      <MostReadBand posts={mostReadPosts} />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-5 py-20 sm:px-8">
        {/* Category spotlights */}
        {categorySections.length > 0 && (
          <section className="flex flex-col">
            <div className="mb-10">
              <Kicker
                label="Spotlight"
                title="What's Trending by Category"
                subtitle="A closer look at what readers in our busiest categories are into right now."
              />
            </div>
            <div className="flex flex-col gap-8">
            {categorySections.map((section, i) => (
              <CategorySpotlight
                key={section.category._id ?? section.category.slug}
                category={section.category}
                posts={section.posts}
                align={i % 2 === 0 ? "left" : "right"}
              />
            ))}
            </div>
          </section>
        )}

        {/* Archive mosaic */}
        {browseCategories.length > 0 && (
          <section className="flex flex-col gap-6">
            <Kicker label="Explore" title="Browse the Archive" subtitle="Every topic we cover, all in one place." />
            <CategoryMosaic categories={browseCategories} />
          </section>
        )}

        {/* Fresh This Week — dense list with Load More */}
        <section className="flex flex-col gap-6">
          <Kicker label="Catch Up" title="Fresh This Week" subtitle="The latest arrivals, freshly published." />
          <LoadMoreArticles initialPosts={initialPosts} total={totalPosts} />
        </section>

        {/* Newsletter CTA */}
        <NewsletterCta />
      </div>
    </div>
  );
}
