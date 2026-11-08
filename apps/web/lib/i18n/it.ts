import type { Dictionary } from "./dictionary";

export const it: Dictionary = {
  canonicalMetaTitle: (storeName) => `Codici Sconto e Coupon ${storeName}`,

  variants: {
    "never-pay-full": {
      tagline: (name) => `Non pagare mai più il prezzo pieno da ${name}`,
      metaTitle: (name) => `Coupon ${name} — Mai Più Prezzo Pieno`,
      metaDescription: (name) => `Smetti di pagare il prezzo pieno da ${name}. Codici sconto verificati e offerte attive, controllati e aggiornati regolarmente.`,
    },
    "todays-deals": {
      tagline: (name) => `L'offerta del giorno da ${name}`,
      metaTitle: (name) => `Offerte e Codici Sconto ${name} di Oggi`,
      metaDescription: (name) => `Scopri le offerte di oggi e i codici sconto verificati per ${name}, aggiornati regolarmente.`,
    },
    "free-shipping-codes": {
      tagline: (name) => `Spedizione gratuita da ${name}, verificata`,
      metaTitle: (name) => `Codici Spedizione Gratuita ${name}`,
      metaDescription: (name) => `Codici di spedizione gratuita e offerte verificate per ${name} — niente costi di consegna.`,
    },
    "exclusive-offers": {
      tagline: (name) => `Un'offerta esclusiva ${name} per te`,
      metaTitle: (name) => `Offerte Esclusive ${name}`,
      metaDescription: (name) => `Offerte esclusive e codici sconto verificati per ${name}.`,
    },
    "secret-codes": {
      tagline: (name) => `Un codice ${name} che quasi nessuno nota`,
      metaTitle: (name) => `Codici Segreti e Offerte Nascoste ${name}`,
      metaDescription: (name) => `Scopri codici sconto segreti e offerte nascoste per ${name}.`,
    },
    "exclusive-deals": {
      tagline: (name) => `Uno sconto esclusivo ${name}, verificato`,
      metaTitle: (name) => `Sconti Esclusivi ${name}`,
      metaDescription: (name) => `Scopri sconti esclusivi e codici coupon verificati per ${name}.`,
    },
  },

  mechanic: {
    link: {
      delayNoteBold: "Aspetta 5-10 secondi.",
      delayNoteRest: (storeName) => `${storeName} ha bisogno di un momento per registrare lo sconto. Non aggiornare la pagina — riapparirà al checkout.`,
      proofStep2Body: () => "Lo sconto si applica alla tua sessione. Continua a navigare, non aggiornare la pagina.",
      handoffStep2Body: () => "Lo sconto si sta registrando sulla tua sessione in background.",
    },
    code: {
      delayNoteBold: "Incollalo al checkout.",
      delayNoteRest: () => "Il codice va inserito nel campo sconto al momento del pagamento, non nella pagina del prodotto.",
      proofStep2Body: () => "Aggiungi ciò che vuoi al carrello, poi vai alla pagina di pagamento.",
      handoffStep2Body: () => "Aggiungi i tuoi articoli, poi vai al pagamento e incolla il codice sopra.",
    },
    popup: {
      delayNoteBold: "Attendi il popup.",
      delayNoteRest: () => "Ci vogliono 5-10 secondi per comparire dopo l'apertura della pagina.",
      proofStep2Body: () => "Un pannello con lo sconto scorrerà nella pagina. Lascialo aperto e seguilo.",
      handoffStep2Body: () => "Comparirà un popup con lo sconto. Lascialo aperto.",
    },
  },

  storeHeader: {
    testedLiveOffer: (dateShort) => `Verificato il ${dateShort} · 1 offerta attiva`,
    copied: "Copiato!",
    getDiscountCode: "Ottieni il Codice Sconto",
    getDiscountDeal: "Ottieni l'Offerta",
    ctaAriaLabel: (hasCode, storeName) => `${hasCode ? "Ottieni il codice sconto" : "Ottieni l'offerta"} per ${storeName}`,
    searchAriaLabel: "Cerca",
  },

  storeHero: {
    home: "Home",
    liveOffer: (testedDateLong) => `1 offerta attiva${testedDateLong ? `, verificata il ${testedDateLong}` : ""}`,
    onTheRightPage: "Sei nella pagina giusta",
    ownCutsLine: (storeName, discountLabel) => `Gli sconti di ${storeName} — il ${discountLabel} si somma in aggiunta`,
    bundleAriaLabel: "Bundle",
  },

  offerVoucher: {
    voucherLabel: (storeName) => `Buono ${storeName}`,
    serialLine: (serial) => `N. ${serial} · 1 DI 1`,
    verified: "VERIFICATO",
    thisVoucherIsWorth: "Questo buono vale",
    getCode: "Ottieni Codice",
    getDeal: "Ottieni Offerta",
    copied: "Copiato!",
    pasteAtCheckout: "Incollalo al checkout",
    redirectingNow: "Reindirizzamento in corso",
    tapToCopyCode: "Tocca qui per copiare il codice",
    tapToLoadDeal: "Tocca qui per attivare l'offerta",
    onePerOrderNoExpiry: "UNO PER ORDINE · NESSUNA SCADENZA INDICATA",
    copyDiscountCodeAria: "Copia il codice sconto",
    copyDealLinkAria: "Copia il link dell'offerta",
  },

  stickyMobileBar: {
    liveOffer: "1 offerta attiva",
    testedPrefix: (dateShort) => `Verificato il ${dateShort} · `,
    getDiscountCode: "Ottieni il Codice Sconto",
    getDiscountDeal: "Ottieni l'Offerta",
  },

  allDeals: {
    eyebrow: "Tutte le offerte attive",
    heading: (count, storeName) => `Tutte le ${count} offerte ${storeName} che abbiamo verificato`,
    verifiedCode: "Codice verificato",
    verifiedLink: "Link verificato",
    codeDeal: "Offerta con codice",
    productDeal: "Offerta prodotto",
    bestOffer: "Offerta migliore",
    getCode: "Ottieni Codice",
    getDeal: "Ottieni Offerta",
    copied: "Copiato!",
    copyDiscountCodeAria: "Copia il codice sconto",
    copyDealLinkAria: "Copia il link dell'offerta",
    wholeListStrong: "Questa è la lista completa.",
    wholeListRest: (storeName) => `Questi sono tutti gli sconti attivi che abbiamo verificato per ${storeName} in questo momento — quando uno scade, rimuoviamo la riga invece di lasciare un codice morto solo per gonfiare il conteggio.`,
    offUnit: "SCONTO",
    dealFallbackLabel: "Offerta",
  },

  honesty: {
    eyebrow: "Nessun riempitivo, nessuna scommessa",
    heading: (storeName) => `Ogni offerta ${storeName} qui sopra è una che abbiamo davvero aperto e controllato.`,
    body: "Altri siti riempiono le loro liste di ipotesi nella speranza che qualcosa funzioni, lasciando a te il compito di testarle. Noi preferiamo pubblicare una lista più corta ma vera, piuttosto che una più lunga ma inaffidabile.",
    lastFullCheckPrefix: "Ultimo controllo completo il ",
    lastFullCheckSuffix: (verifierName) => ` da ${verifierName}.`,
    nextCheck: (dateShort) => ` Prossimo controllo il ${dateShort}.`,
    whatStoreDoesNotOffer: (storeName) => `Cosa non offre ${storeName}`,
  },

  proof: {
    eyebrow: "Prove, non promesse",
    heading: "Esattamente cosa vedrai dopo aver cliccato",
    subheading: (storeName) => `Screenshot reali di un ordine effettuato da ${storeName}, non simulazioni.`,
    step1: (storeName) => `Atterri su ${storeName}. Una normale pagina del negozio. Anche i prezzi sembrano normali — è previsto.`,
    step3: (discountLabel) => `Vedi lo sconto. Una riga ${discountLabel} sopra il totale. Se manca, non è stato applicato nulla — non pagare il prezzo pieno.`,
    didntLandStrong: "Non ha funzionato?",
    didntLandBeforeLink: "Svuota il carrello, riapri il link in una nuova scheda e aspetta qualche secondo prima di aggiungere qualcosa. Ancora niente —",
    tellUsLink: "faccelo sapere",
    didntLandAfterLink: "e daremo un'occhiata.",
  },

  howWeCheck: {
    heading: "Come verifichiamo un'offerta",
    steps: ["Effettuiamo un ordine reale", "Controlliamo di nuovo ogni 7 giorni", "Le offerte scadute vengono rimosse"],
    howWeMakeMoneyHeading: "Come guadagniamo.",
    howWeMakeMoneyBody: "Quando usi un link qui, il negozio potrebbe pagarci una piccola commissione. Per te non cambia nulla, e non influisce mai su cosa pubblichiamo o quale offerta mostriamo.",
    questionsHeading: "Domande",
  },

  handoff: {
    closeAria: "Chiudi",
    dialogAriaLabel: (storeName) => `Coupon ${storeName}`,
    yourCouponCode: "Il tuo codice sconto",
    copied: "Copiato!",
    copyCode: "Copia Codice",
    copyCodeAndGetDeal: "Copia Codice e Ottieni l'Offerta",
    getDeal: "Ottieni Offerta",
    bundleAndSave: "Bundle e risparmia",
    extraOff: (percent) => `+${percent}% di sconto extra`,
    save: (amount, percentSuffix) => `Risparmia ${amount}${percentSuffix}`,
    getThisBundle: "Ottieni Questo Bundle",
    details: "Dettagli",
    featuredProductHeading: "Potrebbe interessarti anche",
    getThisProduct: "Ottieni Questo Prodotto",
  },

  footer: {
    blurb: "Un'offerta verificata per negozio, controllata a mano — non una lista gonfiata di ipotesi.",
    columns: [
      {
        label: "Esplora",
        links: [
          { href: "/stores", label: "Tutti i negozi" },
          { href: "/categories", label: "Categorie" },
          { href: "/blog", label: "Blog" },
        ],
      },
      {
        label: "Fiducia",
        links: [
          { href: "#how-we-check", label: "Come verifichiamo" },
          { href: "/contact", label: "Contattaci" },
          { href: "/about", label: "Chi siamo" },
        ],
      },
      {
        label: "Legale",
        links: [
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Termini" },
          { href: "/cookie-policy", label: "Cookie" },
        ],
      },
    ],
    copyright: (year) => `© ${year} VivaBloom`,
  },

  emptyOffer: {
    heading: (storeName) => `Nessuna offerta verificata da ${storeName} al momento`,
    body: (storeName) => `Pubblichiamo solo offerte che abbiamo testato noi stessi. ${storeName} non ne ha una attiva al momento — torna a controllare più tardi, oppure esplora altri negozi qui sotto.`,
    browseAllStores: "Esplora tutti i negozi",
  },

  relatedArticles: {
    heading: "Letture correlate",
    allArticles: "Tutti gli articoli",
  },

  offerFallbacks: {
    trustChecks: ["Nessuna registrazione richiesta", "Verificato dal nostro team", "Si apre in una nuova scheda", "Sempre gratuito"],
    notOffered: [
      "Non cumulabile — uno sconto per ordine",
      "Nessun codice esclusivo per studenti, militari o primo ordine",
      "Nessun codice spedizione gratuita separato, salvo diversa indicazione",
      "Non valido su articoli in liquidazione o saldi finali",
    ],
    lede: (storeName, verifiedDateLong) => {
      const dateClause = verifiedDateLong ? `il ${verifiedDateLong}` : "noi stessi";
      return `Questa è la migliore offerta verificata di ${storeName}. L'abbiamo testata ${dateClause} per confermare che funziona, e lo diremo il giorno in cui smetterà di farlo.`;
    },
    defaultVerifierName: "Team VivaBloom",
    discountSuffixOff: (storeName) => `su ${storeName}`,
    discountSuffixAt: (storeName) => `da ${storeName}`,
    dealFallbackLabel: "Offerta",
  },
};
