# Locale packs

One JSON file per language. `pnpm db:import-locales` validates them and pushes
them to the `KeywordLocale` collection.

## Order is data, not formatting

Every array is **ranked, best first**. Rank decides which keywords survive when
a campaign hits its keyword ceiling, so reordering a list changes what gets
bought. It is the highest-leverage edit in this directory and needs no code
change.

## Who we are ranking for

**Someone who has decided to buy and is looking for a code to paste at
checkout.** Not someone browsing for sales. That single sentence decides the
whole ordering, and it routinely puts the *highest-volume* term near the bottom.

The ranking rule, in order:

1. **Code-bearing terms** — `code promo`, `codice sconto`, `kortingscode`,
   `kod rabatowy`, `rabatkode`, `código descuento`, `Rabattcode`. Someone typing
   "code" has a cart open.
2. **Bare "code"** in that language — `code`, `codice`, `kod`, `kode`, `código`.
   High volume, and in brand context (`[Store] kod`) unambiguously our buyer.
3. **Coupon / discount nouns** — `coupon`, `réduction`, `sconto`, `korting`,
   `rabat`, `descuento`.
4. **Offer nouns** — `offre`, `offerta`, `aanbieding`, `oferta`, `Angebot`.
5. **Browse / sale-season terms last** — `soldes`, `saldi`, `rebajas`,
   `wyprzedaż`, `uitverkoop`, `udsalg`, `sale`, `chollo`. These carry enormous
   volume and the cheapest bids, which is the signature of window shopping.

Where volume and intent disagree, **top-of-page bid is the tiebreaker** —
advertisers do not pay $7 a click for browsers.

## Checking a language

```bash
pnpm db:import-locales --terms=fr
```

One term per line, paste straight into Keyword Planner with the target country
selected. `--field=offerModifiers` works too.

## Verified data

All figures from Google Keyword Planner, checked **2026-08-05**, country
targeted, terms measured standalone.

### The finding that reordered every pack

The bare word for "code" was ranked **last or near-last in all seven packs** and
turned out to be top-tier in every single market:

| term | volume | top bid | was ranked |
|---|---:|---:|---|
| fr `code` | 60,500 | $1.45 | 25th of 25 |
| es `código` | 40,500 | $0.72 | 22nd of 22 |
| de `Code` | 22,200 | $7.00 | 24th of 25 |
| it `codice` | 22,200 | $2.14 | 20th of 20 |
| pl `kod` | 14,800 | **$20.00** | 20th of 21 |
| nl `code` | 12,100 | $3.22 | 23rd of 24 |
| da `kode` | 1,300 | — | 17th of 18 |

Polish `kod` at a $20.00 top-of-page bid is the strongest intent signal in the
entire dataset.

### Highest volume ≠ our buyer

Every market's biggest term is a browse term with the cheapest bid, and is now
ranked last:

| language | term | volume | top bid |
|---|---|---:|---:|
| fr | soldes | 135,000 | $0.81 |
| pl | promocja | 135,000 | $0.96 |
| de | Aktion | 110,000 | $1.30 |
| es | rebajas / chollo | 33,100 | $0.46 |
| it | saldi | 22,200 | $0.87 |
| nl | sale | 18,100 | $1.03 |
| da | tilbud | 8,100 | $1.29 |

German `Gutschein` (74,000, **High** competition, $3.45) is the exception that
proves the rule: high volume *and* high competition, and it means "voucher"
rather than "sale season". It stays near the top.

### Per-language notes

- **de** — `Rabattcode` (33,100, $6.29) beats `Gutscheincode` (9,900, $3.38) on
  both volume and bid. `Aktionscode` kept high on only 1,600 searches because of
  its $6.47 bid.
- **fr** — `code promo` (33,100, $2.96) is canonical. `code réduction` (8,100,
  $3.29) outbids it and sits just behind.
- **it** — `codice promozionale` / `codice promo` carry the top bid ($5.01) on
  only 1,600 searches. `buono`/`buoni` (8,100, $3.70) were underranked.
- **es** — `código promocional` / `código promo` at **$8.30** is the highest bid
  in Spanish despite 1,000 searches.
- **nl** — `promotiecode` ($5.44) and `couponcode` ($4.50) are tiny by volume but
  bid like buyer terms. `bonnen` (720, $5.01) likewise.
- **pl** — see `kod` above.
- **da** — smallest market; `rabatkode` (1,300, $2.16) is the clear canonical
  term, `koder` (2,900) the highest-volume code form.

## Caveat on the method

Keyword Planner measures these terms **standalone**, but campaigns only ever use
them attached to a brand (`[Store] kortingscode`). Standalone volume is a proxy.
To settle a close call, measure the brand-modified forms against a large store
in that market:

```
zalando gutschein
zalando gutscheincode
zalando rabattcode
zalando aktion
```

Expect the browse terms to fall further still in brand context.

## Status

| locale | intentTerms ranked against Keyword Planner |
|---|---|
| de | yes — 2026-08-05 |
| fr | yes — 2026-08-05 |
| it | yes — 2026-08-05 |
| es | yes — 2026-08-05 |
| nl | yes — 2026-08-05 |
| pl | yes — 2026-08-05 |
| da | yes — 2026-08-05 |
| en | **no** — still ordered by assumption, and carries the same "code last" error |

Only `intentTerms` has been checked. `offerModifiers`, `seasonalModifiers` and
`verticals` are still ranked by assumption in every language.

## Adding a language

Copy an existing file, translate, and run the import. The validator enforces the
things that cost money — most importantly that no term appears in both a
positive list and `negativeKeywords`, which would make a campaign bid on a
keyword and block it at the same time.

Month keys are always the **English** month name; the values carry local
spellings. That way one campaign-month setting resolves across every language.
