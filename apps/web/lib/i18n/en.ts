import type { Dictionary } from "./dictionary";

/**
 * The baseline dictionary — every string here is extracted verbatim from the
 * existing hardcoded JSX/templates (no wording changed), so wiring this in
 * later reproduces today's page exactly. See dictionary.ts for what's
 * deliberately excluded (admin-authored content and its English-only generic
 * fallbacks).
 */
export const en: Dictionary = {
  canonicalMetaTitle: (storeName) => `${storeName} Coupons & Promo Codes`,

  variants: {
    "never-pay-full": {
      tagline: (name) => `Never pay full price at ${name} again`,
      metaTitle: (name) => `${name} Coupons — Never Pay Full Price`,
      metaDescription: (name) => `Stop paying full price at ${name}. Verified coupon codes and active deals, checked and updated regularly.`,
    },
    "todays-deals": {
      tagline: (name) => `Today's live deal at ${name}`,
      metaTitle: (name) => `Today's ${name} Deals & Coupon Codes`,
      metaDescription: (name) => `See today's live deals and verified coupon codes for ${name}, updated regularly.`,
    },
    "free-shipping-codes": {
      tagline: (name) => `Free shipping at ${name}, verified`,
      metaTitle: (name) => `${name} Free Shipping Codes`,
      metaDescription: (name) => `Verified free shipping codes and deals for ${name} — skip the delivery fee.`,
    },
    "exclusive-offers": {
      tagline: (name) => `An exclusive ${name} offer for you`,
      metaTitle: (name) => `Exclusive ${name} Offers`,
      metaDescription: (name) => `Exclusive offers and verified coupon codes for ${name}.`,
    },
    "secret-codes": {
      tagline: (name) => `A ${name} code most shoppers miss`,
      metaTitle: (name) => `${name} Secret Codes & Hidden Deals`,
      metaDescription: (name) => `Uncover secret coupon codes and hidden deals for ${name}.`,
    },
    "exclusive-deals": {
      tagline: (name) => `An exclusive ${name} deal, verified`,
      metaTitle: (name) => `Exclusive ${name} Deals`,
      metaDescription: (name) => `Shop exclusive deals and verified coupon codes for ${name}.`,
    },
  },

  mechanic: {
    link: {
      delayNoteBold: "Give it 5–10 seconds.",
      delayNoteRest: (storeName) => `${storeName} needs a moment to register the discount. Don't refresh — it shows again at checkout.`,
      proofStep2Body: () => "The discount attaches to your session. Keep browsing, don't refresh.",
      handoffStep2Body: () => "The discount is registering against your session in the background.",
    },
    code: {
      delayNoteBold: "Paste it at checkout.",
      delayNoteRest: () => "The code goes in the discount box on the payment step, not on the product page.",
      proofStep2Body: () => "Add what you want to the cart, then head to the payment step.",
      handoffStep2Body: () => "Add your items, then go to the payment step and paste the code above.",
    },
    popup: {
      delayNoteBold: "Wait for the popup.",
      delayNoteRest: () => "It takes 5–10 seconds to appear after you land.",
      proofStep2Body: () => "A panel slides in with the discount. Leave it open and follow it.",
      handoffStep2Body: () => "A popup with the discount will appear. Leave it open.",
    },
  },

  storeHeader: {
    testedLiveOffer: (dateShort) => `Tested ${dateShort} · 1 live offer`,
    copied: "Copied!",
    getDiscountCode: "Get Discount Code",
    getDiscountDeal: "Get Discount Deal",
    ctaAriaLabel: (hasCode, storeName) => `${hasCode ? "Get discount code" : "Get discount deal"} for ${storeName}`,
    searchAriaLabel: "Search",
  },

  storeHero: {
    home: "Home",
    liveOffer: (testedDateLong) => `1 live offer${testedDateLong ? `, tested ${testedDateLong}` : ""}`,
    onTheRightPage: "You’re on the right page",
    ownCutsLine: (storeName, discountLabel) => `${storeName}’s own cuts — the ${discountLabel} comes off on top`,
    bundleAriaLabel: "Bundle",
  },

  offerVoucher: {
    voucherLabel: (storeName) => `${storeName} Voucher`,
    serialLine: (serial) => `NO. ${serial} · 1 OF 1`,
    verified: "VERIFIED",
    thisVoucherIsWorth: "This voucher is worth",
    getCode: "Get Code",
    getDeal: "Get Deal",
    copied: "Copied!",
    pasteAtCheckout: "Paste it at checkout",
    redirectingNow: "Redirecting you now",
    tapToCopyCode: "Tap here to copy the code",
    tapToLoadDeal: "Tap here to load the deal",
    onePerOrderNoExpiry: "ONE PER ORDER · NO EXPIRY GIVEN",
    copyDiscountCodeAria: "Copy discount code",
    copyDealLinkAria: "Copy deal link",
  },

  stickyMobileBar: {
    liveOffer: "1 live offer",
    testedPrefix: (dateShort) => `Tested ${dateShort} · `,
    getDiscountCode: "Get Discount Code",
    getDiscountDeal: "Get Discount Deal",
  },

  allDeals: {
    eyebrow: "Every live offer",
    heading: (count, storeName) => `All ${count} ${storeName} deals we could verify`,
    verifiedCode: "Verified code",
    verifiedLink: "Verified link",
    codeDeal: "Code deal",
    productDeal: "Product deal",
    bestOffer: "Best offer",
    getCode: "Get Code",
    getDeal: "Get Deal",
    copied: "Copied!",
    copyDiscountCodeAria: "Copy discount code",
    copyDealLinkAria: "Copy deal link",
    wholeListStrong: "That’s the whole list.",
    wholeListRest: (storeName) => `These are every live discount we could verify for ${storeName} right now — when one expires we remove the row instead of leaving a dead code up to pad the count.`,
    offUnit: "OFF",
    dealFallbackLabel: "Deal",
  },

  honesty: {
    eyebrow: "No padding, no guessing",
    heading: (storeName) => `Every ${storeName} deal above is one we actually opened and checked.`,
    body: "Other sites pad their lists with guesses so that something eventually works, and you do the testing. We’d rather publish a shorter list that’s true than a longer one that isn’t.",
    lastFullCheckPrefix: "Last full check ",
    lastFullCheckSuffix: (verifierName) => ` by ${verifierName}.`,
    nextCheck: (dateShort) => ` Next check ${dateShort}.`,
    whatStoreDoesNotOffer: (storeName) => `What ${storeName} does not offer`,
  },

  proof: {
    eyebrow: "Proof, not promises",
    heading: "Exactly what you’ll see after you click",
    subheading: (storeName) => `Real screenshots from an order we placed at ${storeName}, not mockups.`,
    step1: (storeName) => `You land on ${storeName}. A normal store page. Prices still look normal too — that's expected.`,
    step3: (discountLabel) => `You see the discount. A ${discountLabel} line above the total. If it's missing, nothing was applied — don't pay full price.`,
    didntLandStrong: "Didn’t land?",
    didntLandBeforeLink: "Clear your cart, reopen the link in a fresh tab, and wait a few seconds before adding anything. Still nothing —",
    tellUsLink: "tell us",
    didntLandAfterLink: "and we’ll take a look.",
  },

  howWeCheck: {
    heading: "How we check an offer",
    steps: ["We place a real order", "We re-check every 7 days", "Dead offers come down"],
    howWeMakeMoneyHeading: "How we make money.",
    howWeMakeMoneyBody: "When you use a link here, the store may pay us a small commission. It costs you nothing, and it never changes what we publish or which offer we show.",
    questionsHeading: "Questions",
  },

  handoff: {
    closeAria: "Close",
    dialogAriaLabel: (storeName) => `${storeName} coupon`,
    yourCouponCode: "Your coupon code",
    copied: "Copied!",
    copyCode: "Copy Code",
    copyCodeAndGetDeal: "Copy Code & Get Deal",
    getDeal: "Get Deal",
    bundleAndSave: "Bundle & save",
    extraOff: (percent) => `+${percent}% extra off`,
    save: (amount, percentSuffix) => `Save ${amount}${percentSuffix}`,
    getThisBundle: "Get This Bundle",
    details: "Details",
    featuredProductHeading: "You might also like",
    getThisProduct: "Get This Product",
  },

  footer: {
    blurb: "One verified offer per store, checked by hand — not a padded list of guesses.",
    columns: [
      {
        label: "Browse",
        links: [
          { href: "/stores", label: "All stores" },
          { href: "/categories", label: "Categories" },
          { href: "/blog", label: "Blog" },
        ],
      },
      {
        label: "Trust",
        links: [
          { href: "#how-we-check", label: "How we check" },
          { href: "/contact", label: "Contact us" },
          { href: "/about", label: "About" },
        ],
      },
      {
        label: "Legal",
        links: [
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
          { href: "/cookie-policy", label: "Cookies" },
        ],
      },
    ],
    copyright: (year) => `© ${year} VivaBloom`,
  },

  emptyOffer: {
    heading: (storeName) => `No verified offer at ${storeName} right now`,
    body: (storeName) => `We only publish offers we’ve tested ourselves. ${storeName} doesn’t have one live at the moment — check back soon, or browse other stores below.`,
    browseAllStores: "Browse all stores",
  },

  relatedArticles: {
    heading: "Related reading",
    allArticles: "All articles",
  },

  offerFallbacks: {
    trustChecks: ["No signup needed", "Checked by our team", "Opens in a new tab", "Free to use, always"],
    notOffered: [
      "No stacking — one discount per order",
      "No student, military, or first-order exclusive code",
      "No separate free-shipping code unless stated",
      "Not valid on clearance or final-sale items",
    ],
    lede: (storeName, verifiedDateLong) => {
      const dateClause = verifiedDateLong ? `on ${verifiedDateLong}` : "ourselves";
      return `This is ${storeName}'s best verified offer. We tested it ${dateClause} to confirm it lands, and we'll say so the day it stops.`;
    },
    defaultVerifierName: "VivaBloom Team",
    discountSuffixOff: (storeName) => `off ${storeName}`,
    discountSuffixAt: (storeName) => `at ${storeName}`,
    dealFallbackLabel: "Deal",
  },
};
