export const SITE_URL = "https://monocoupon.com";

interface CrumbInput {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: CrumbInput[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function itemListJsonLd(items: CrumbInput[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}

export function faqPageJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function storeOffersJsonLd(
  store: { slug: string },
  coupons: { title: string; description?: string; expiryDate?: string | null }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: coupons.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Offer",
        name: c.title,
        description: c.description || undefined,
        validThrough: c.expiryDate || undefined,
        url: `${SITE_URL}/stores/${store.slug}`,
      },
    })),
  };
}

export function productJsonLd(product: {
  name: string;
  slug: string;
  description?: string;
  image: string;
  price: number;
  storeName?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.image,
    url: `${SITE_URL}/products/${product.slug}`,
    brand: product.storeName ? { "@type": "Brand", name: product.storeName } : undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/products/${product.slug}`,
    },
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  excerpt?: string;
  slug: string;
  publishedAt?: string | null;
  coverImage?: string | null;
  tags?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt || undefined,
    image: post.coverImage || undefined,
    keywords: post.tags && post.tags.length > 0 ? post.tags.join(", ") : undefined,
    author: { "@type": "Organization", name: "VivaBloom" },
    publisher: { "@type": "Organization", name: "VivaBloom" },
  };
}
