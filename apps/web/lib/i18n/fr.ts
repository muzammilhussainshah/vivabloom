import type { Dictionary } from "./dictionary";

export const fr: Dictionary = {
  canonicalMetaTitle: (storeName) => `Codes Promo et Coupons ${storeName}`,

  variants: {
    "never-pay-full": {
      tagline: (name) => `Ne payez plus jamais le prix fort chez ${name}`,
      metaTitle: (name) => `Coupons ${name} — Ne Payez Plus Jamais Plein Tarif`,
      metaDescription: (name) => `Arrêtez de payer plein tarif chez ${name}. Codes promo vérifiés et offres actives, contrôlés et mis à jour régulièrement.`,
    },
    "todays-deals": {
      tagline: (name) => `L'offre du jour chez ${name}`,
      metaTitle: (name) => `Offres et Codes Promo ${name} du Jour`,
      metaDescription: (name) => `Découvrez les offres du jour et les codes promo vérifiés pour ${name}, mis à jour régulièrement.`,
    },
    "free-shipping-codes": {
      tagline: (name) => `Livraison gratuite chez ${name}, vérifiée`,
      metaTitle: (name) => `Codes Livraison Gratuite ${name}`,
      metaDescription: (name) => `Codes de livraison gratuite et offres vérifiées pour ${name} — évitez les frais de port.`,
    },
    "exclusive-offers": {
      tagline: (name) => `Une offre exclusive ${name} pour vous`,
      metaTitle: (name) => `Offres Exclusives ${name}`,
      metaDescription: (name) => `Offres exclusives et codes promo vérifiés pour ${name}.`,
    },
    "secret-codes": {
      tagline: (name) => `Un code ${name} que peu de clients remarquent`,
      metaTitle: (name) => `Codes Secrets et Offres Cachées ${name}`,
      metaDescription: (name) => `Découvrez des codes promo secrets et des offres cachées pour ${name}.`,
    },
    "exclusive-deals": {
      tagline: (name) => `Une remise exclusive ${name}, vérifiée`,
      metaTitle: (name) => `Remises Exclusives ${name}`,
      metaDescription: (name) => `Profitez de remises exclusives et de codes promo vérifiés pour ${name}.`,
    },
  },

  mechanic: {
    link: {
      delayNoteBold: "Patientez 5 à 10 secondes.",
      delayNoteRest: (storeName) => `${storeName} a besoin d'un instant pour enregistrer la réduction. Ne rafraîchissez pas — elle réapparaîtra au moment de payer.`,
      proofStep2Body: () => "La réduction s'associe à votre session. Continuez à naviguer, ne rafraîchissez pas.",
      handoffStep2Body: () => "La réduction s'enregistre actuellement sur votre session en arrière-plan.",
    },
    code: {
      delayNoteBold: "Collez-le au moment de payer.",
      delayNoteRest: () => "Le code se saisit dans le champ prévu à l'étape du paiement, pas sur la page produit.",
      proofStep2Body: () => "Ajoutez ce que vous voulez au panier, puis passez à l'étape du paiement.",
      handoffStep2Body: () => "Ajoutez vos articles, puis passez au paiement et collez le code ci-dessus.",
    },
    popup: {
      delayNoteBold: "Attendez la fenêtre popup.",
      delayNoteRest: () => "Elle met 5 à 10 secondes à apparaître après votre arrivée sur la page.",
      proofStep2Body: () => "Un panneau avec la réduction apparaît. Laissez-le ouvert et suivez les étapes.",
      handoffStep2Body: () => "Une fenêtre popup avec la réduction va apparaître. Laissez-la ouverte.",
    },
  },

  storeHeader: {
    testedLiveOffer: (dateShort) => `Vérifié le ${dateShort} · 1 offre active`,
    copied: "Copié !",
    getDiscountCode: "Obtenir le Code Promo",
    getDiscountDeal: "Obtenir l'Offre",
    ctaAriaLabel: (hasCode, storeName) => `${hasCode ? "Obtenir le code promo" : "Obtenir l'offre"} pour ${storeName}`,
    searchAriaLabel: "Rechercher",
  },

  storeHero: {
    home: "Accueil",
    liveOffer: (testedDateLong) => `1 offre active${testedDateLong ? `, vérifiée le ${testedDateLong}` : ""}`,
    onTheRightPage: "Vous êtes au bon endroit",
    ownCutsLine: (storeName, discountLabel) => `Les réductions propres à ${storeName} — le ${discountLabel} s'ajoute en plus`,
    bundleAriaLabel: "Lot",
  },

  offerVoucher: {
    voucherLabel: (storeName) => `Bon ${storeName}`,
    serialLine: (serial) => `N° ${serial} · 1 SUR 1`,
    verified: "VÉRIFIÉ",
    thisVoucherIsWorth: "Ce bon vous offre",
    getCode: "Obtenir le Code",
    getDeal: "Obtenir l'Offre",
    copied: "Copié !",
    pasteAtCheckout: "Collez-le au moment de payer",
    redirectingNow: "Redirection en cours",
    tapToCopyCode: "Touchez ici pour copier le code",
    tapToLoadDeal: "Touchez ici pour activer l'offre",
    onePerOrderNoExpiry: "UN PAR COMMANDE · AUCUNE EXPIRATION INDIQUÉE",
    copyDiscountCodeAria: "Copier le code promo",
    copyDealLinkAria: "Copier le lien de l'offre",
  },

  stickyMobileBar: {
    liveOffer: "1 offre active",
    testedPrefix: (dateShort) => `Vérifié le ${dateShort} · `,
    getDiscountCode: "Obtenir le Code Promo",
    getDiscountDeal: "Obtenir l'Offre",
  },

  allDeals: {
    eyebrow: "Toutes les offres actives",
    heading: (count, storeName) => `Les ${count} offres ${storeName} que nous avons vérifiées`,
    verifiedCode: "Code vérifié",
    verifiedLink: "Lien vérifié",
    codeDeal: "Offre avec code",
    productDeal: "Offre produit",
    bestOffer: "Meilleure offre",
    getCode: "Obtenir le Code",
    getDeal: "Obtenir l'Offre",
    copied: "Copié !",
    copyDiscountCodeAria: "Copier le code promo",
    copyDealLinkAria: "Copier le lien de l'offre",
    wholeListStrong: "C'est la liste complète.",
    wholeListRest: (storeName) => `Voici toutes les réductions actives que nous avons pu vérifier pour ${storeName} en ce moment — dès qu'une offre expire, nous retirons la ligne au lieu de laisser un code mort pour gonfler le nombre.`,
    offUnit: "RÉDUCTION",
    dealFallbackLabel: "Offre",
  },

  honesty: {
    eyebrow: "Pas de remplissage, pas de suppositions",
    heading: (storeName) => `Chaque offre ${storeName} ci-dessus est une offre que nous avons réellement ouverte et vérifiée.`,
    body: "D'autres sites remplissent leurs listes de suppositions en espérant que quelque chose finisse par fonctionner, et c'est vous qui faites les tests. Nous préférons publier une liste plus courte mais vraie plutôt qu'une plus longue mais peu fiable.",
    lastFullCheckPrefix: "Dernier contrôle complet le ",
    lastFullCheckSuffix: (verifierName) => ` par ${verifierName}.`,
    nextCheck: (dateShort) => ` Prochain contrôle le ${dateShort}.`,
    whatStoreDoesNotOffer: (storeName) => `Ce que ${storeName} ne propose pas`,
  },

  proof: {
    eyebrow: "Des preuves, pas des promesses",
    heading: "Exactement ce que vous verrez après avoir cliqué",
    subheading: (storeName) => `De vraies captures d'écran d'une commande passée chez ${storeName}, pas des simulations.`,
    step1: (storeName) => `Vous arrivez chez ${storeName}. Une page de boutique normale. Les prix aussi semblent normaux — c'est prévu.`,
    step3: (discountLabel) => `Vous voyez la réduction. Une ligne ${discountLabel} au-dessus du total. Si elle manque, rien n'a été appliqué — ne payez pas plein tarif.`,
    didntLandStrong: "Ça n'a pas fonctionné ?",
    didntLandBeforeLink: "Videz votre panier, rouvrez le lien dans un nouvel onglet, et attendez quelques secondes avant d'ajouter quoi que ce soit. Toujours rien —",
    tellUsLink: "dites-le-nous",
    didntLandAfterLink: "et nous y jetterons un œil.",
  },

  howWeCheck: {
    heading: "Comment nous vérifions une offre",
    steps: ["Nous passons une vraie commande", "Nous revérifions tous les 7 jours", "Les offres expirées sont retirées"],
    howWeMakeMoneyHeading: "Comment nous gagnons de l'argent.",
    howWeMakeMoneyBody: "Lorsque vous utilisez un lien ici, la boutique peut nous verser une petite commission. Cela ne vous coûte rien, et cela ne change jamais ce que nous publions ni l'offre que nous montrons.",
    questionsHeading: "Questions",
  },

  handoff: {
    closeAria: "Fermer",
    dialogAriaLabel: (storeName) => `Coupon ${storeName}`,
    yourCouponCode: "Votre code promo",
    copied: "Copié !",
    copyCode: "Copier le Code",
    copyCodeAndGetDeal: "Copier le Code et Obtenir l'Offre",
    getDeal: "Obtenir l'Offre",
    bundleAndSave: "Lot & économies",
    extraOff: (percent) => `+${percent} % de réduction supplémentaire`,
    save: (amount, percentSuffix) => `Économisez ${amount}${percentSuffix}`,
    getThisBundle: "Obtenir ce Lot",
    details: "Détails",
    featuredProductHeading: "Vous aimerez peut-être aussi",
    getThisProduct: "Obtenir ce Produit",
  },

  footer: {
    blurb: "Une offre vérifiée par boutique, contrôlée à la main — pas une liste gonflée de suppositions.",
    columns: [
      {
        label: "Explorer",
        links: [
          { href: "/stores", label: "Toutes les boutiques" },
          { href: "/categories", label: "Catégories" },
          { href: "/blog", label: "Blog" },
        ],
      },
      {
        label: "Confiance",
        links: [
          { href: "#how-we-check", label: "Comment nous vérifions" },
          { href: "/contact", label: "Nous contacter" },
          { href: "/about", label: "À propos" },
        ],
      },
      {
        label: "Mentions légales",
        links: [
          { href: "/privacy", label: "Confidentialité" },
          { href: "/terms", label: "Conditions" },
          { href: "/cookie-policy", label: "Cookies" },
        ],
      },
    ],
    copyright: (year) => `© ${year} VivaBloom`,
  },

  emptyOffer: {
    heading: (storeName) => `Aucune offre vérifiée chez ${storeName} pour le moment`,
    body: (storeName) => `Nous ne publions que des offres que nous avons testées nous-mêmes. ${storeName} n'en a pas en ce moment — revenez bientôt, ou parcourez d'autres boutiques ci-dessous.`,
    browseAllStores: "Parcourir toutes les boutiques",
  },

  relatedArticles: {
    heading: "À lire aussi",
    allArticles: "Tous les articles",
  },

  offerFallbacks: {
    trustChecks: ["Aucune inscription requise", "Vérifié par notre équipe", "S'ouvre dans un nouvel onglet", "Toujours gratuit"],
    notOffered: [
      "Non cumulable — une réduction par commande",
      "Aucun code exclusif étudiant, militaire ou première commande",
      "Aucun code de livraison gratuite séparé, sauf mention contraire",
      "Non valable sur les articles soldés ou en liquidation",
    ],
    lede: (storeName, verifiedDateLong) => {
      const dateClause = verifiedDateLong ? `le ${verifiedDateLong}` : "nous-mêmes";
      return `Voici la meilleure offre vérifiée chez ${storeName}. Nous l'avons testée ${dateClause} pour confirmer qu'elle fonctionne, et nous le dirons le jour où elle s'arrêtera.`;
    },
    defaultVerifierName: "L'équipe VivaBloom",
    discountSuffixOff: (storeName) => `chez ${storeName}`,
    discountSuffixAt: (storeName) => `chez ${storeName}`,
    dealFallbackLabel: "Offre",
  },
};
