# Plan: Multi-Provider Avalanche Bulletin System

## Context

The system currently only supports Météo-France (French Alps). The research in `docs/avalanche-sources.md` identified viable providers across Europe and the US. This plan covers integrating **all** providers in a unified architecture.

Key challenge: European providers deliver PDFs (like Météo-France), but US providers (avalanche.org) have **no PDFs** — forecasts are HTML-only. The system must support two delivery modes: PDF-based and summary-based (text + link).

---

## PR Structure (5 PRs)

### PR 1: `refactor/multi-provider-support` — Foundation ✅ COMPLETE

Schema migration, type changes, provider abstraction, Météo-France extraction. System behaves identically for existing French users. Continues using the existing `bulletin` WhatsApp template.

> **Implementation notes** (25 files changed, +353/−178 lines):
> - Migration requires **dropping FK constraints** before `INTEGER → TEXT` conversion, then re-adding them after — PostgreSQL cannot cast columns with active foreign key references.
> - Callback regex pattern: `[\w\-/.]+` (includes dots for EAWS codes like `CH-GR.1` and slashes for NAC zones like `BTAC/teton`).
> - `filename` nullability and `summary_text` column **deferred to PR 4** — not needed until summary-based providers exist.
> - `schema.sql` fully synced with production (added `geocode_cache`, `platform`, `geometry`, etc.).
> - Key files created: `providers/types.ts`, `providers/meteoFranceProvider.ts`, `providers/registry.ts`.

**Schema migration** (`scripts/migrate_massif_codes_to_text.sql`):
- Convert `massifs.code`, `bras.massif`, `bra_subscriptions.massif`, `deliveries_bras.massif`, `geocode_cache.massif_code` from `INTEGER` to `TEXT` (lossless `::text` cast)
- Drop FK constraints on `bras.massif`, `bra_subscriptions.massif`, `deliveries_bras.massif`, `geocode_cache.massif_code` before conversion; re-add after
- Add `provider TEXT NOT NULL DEFAULT 'meteofrance'` and `country TEXT NOT NULL DEFAULT 'France'` to `massifs`
- Update `database/schema.sql` to match

**Type changes** (`functions/src/types/index.ts`):
- `Massif.code`: `number` → `string`, add `provider?: string`, `country?: string`
- `Bulletin.massif`: `number` → `string`; make `filename` nullable (`string | null`); add `summary_text?: string`
- All derived types (`BulletinInfos`, `BulletinDestination`, `Subscription`) cascade
- ⏳ `filename` nullability and `summary_text` deferred to PR 4

**Provider abstraction** — new `functions/src/providers/`:
- `types.ts` — `BulletinProvider` interface with `deliveryMode: 'pdf' | 'summary'`, `fetchBulletinMetadata()`, `fetchBulletin()`, `getAvailableContentTypes()`
- `meteoFranceProvider.ts` — extract existing logic from `bulletinService.ts`
- `registry.ts` — maps provider IDs to instances, `getProviderForRegion(code)` resolves via `MassifCache`

**Refactor `bulletinService.ts`** to be provider-agnostic:
- `checkForNewBulletins()` delegates metadata fetch to provider
- `fetchAndStoreBulletins()` delegates PDF/summary fetch to provider, keeps GCS upload as shared logic (skip GCS for summary providers)

**Cascade `number` → `string`** across ~20 files:
- `database/queries.ts`, all `database/models/*.ts`
- `services/imageService.ts` — add provider guard (skip images for non-Météo-France)
- `cache/MassifCache.ts` — `findByCode(code: string)`, add `getCountries()`, `getByCountry()`
- `bot/callbacks/subscriptionCallbacks.ts` — change regex from `\d+` to `[\w\-/.]+`, remove all `parseInt()` for massif codes
- `whatsapp/router.ts` — remove `parseInt()` from `br:mas:` and `unsub:` callbacks
- `whatsapp/flows/bulletin.ts`, `whatsapp/flows/delivery.ts`
- `bot/commands/get.ts`, `bot/commands/subscriptions.ts`, `bot/actions/*`
- `scripts/update_massifs.ts` — cast code to string, set `provider`/`country`

**Content types strategy**: Keep the 7 Météo-France boolean columns in `bra_subscriptions` as-is. For non-MF providers, only `bulletin` is meaningful — the other 6 flags are ignored. `provider.getAvailableContentTypes()` controls which toggles appear in the UI.

---

### PR 2: `feat/whatsapp-templates` — Switch to new WhatsApp templates

Requires `bulletin_pdf` and `bulletin_summary` templates to be approved by Meta first.

- Switch WhatsApp cron delivery from old `bulletin` template to new `bulletin_pdf` template in `whatsapp/flows/delivery.ts`
- Add `sendSummaryTemplate()` function for `bulletin_summary` template (used by PR 4)
- Delete old `bulletin` template from Meta after deployment is verified

---

### PR 3: `feat/eaws-providers` — European EAWS providers + country browse flow

Add avalanche.report (Euregio), lawinen-warnung.eu (Austria), and SLF (Switzerland). All use CAAMLv6 and deliver PDFs.

**CAAMLv6 parser** (`providers/caaml/parser.ts`):
- Parse `validTime.startTime`/`endTime` and max `dangerRatings[].mainValue`
- Shared by all three providers

**EAWS provider** (`providers/eawsProvider.ts`):
- Generic class taking `(id, baseUrl, lang)` — instantiated twice:
  - `new EawsProvider('euregio', 'https://static.avalanche.report', 'en')`
  - `new EawsProvider('lawinen', 'https://static.lawinen-warnung.eu', 'en')`
- Metadata: `GET ${baseUrl}/bulletins/latest/${regionCode}_${lang}_CAAMLv6.json`
- PDF: `GET ${baseUrl}/bulletins/latest/${regionCode}_${lang}.pdf`

**SLF provider** (`providers/slfProvider.ts`):
- Metadata: `GET https://aws.slf.ch/api/bulletin/caaml/en/json` (returns ALL regions — cache per cron run)
- PDF: `GET https://aws.slf.ch/api/bulletin/document/`
- Reuses CAAMLv6 parser

**Seed scripts**:
- `scripts/seed_eaws_regions.ts` — AT-07 (Tyrol), IT-32-BZ, IT-32-TN (Euregio); AT-02 through AT-08, DE-BY, SI (lawinen)
- `scripts/seed_slf_regions.ts` — Swiss warning regions with `provider='slf'`, `country='Switzerland'`

**Browse flow — country layer**:
- **Telegram**: `/get` → Country → (Mountain for France / Region list for others) → Content → Deliver
- **WhatsApp**: `menu:browse` → `showCountries()` → `br:cty:{country}` → mountains or regions
- France keeps the existing Mountain → Massif flow unchanged

---

### PR 4: `feat/nac-provider` — US avalanche.org (summary-based delivery)

Add the National Avalanche Center as a **summary-based** provider — no PDFs, sends forecast text + link instead. Requires PR 2 (for `bulletin_summary` template).

**NAC provider** (`providers/nacProvider.ts`):
- `deliveryMode: 'summary'`
- Metadata: `GET api.avalanche.org/v2/public/products/map-layer/{centerId}` (danger ratings + zone GeoJSON)
- Forecast: `GET api.avalanche.org/v2/public/product?type=forecast&center_id={id}&zone_id={zoneId}` (undocumented but functional)
- Returns `{ summary: { headline: stripHtml(bottom_line), url, problems, mediaUrls } }`
- Fallback: if `product` endpoint returns sparse data, use danger rating + link from `map-layer`

**Schema addition**: `ALTER TABLE bras ADD COLUMN summary_text TEXT; ALTER TABLE bras ALTER COLUMN filename DROP NOT NULL;`

**Summary delivery path** in `contentDeliveryService.ts` and `whatsapp/flows/delivery.ts`:
- When `provider.deliveryMode === 'summary'`: send `bulletin_summary` template (cron) or text message (interactive)
- Telegram: text message + "Full Forecast" URL button + "Subscribe" button

**Seed script** (`scripts/seed_nac_zones.ts`):
- Fetch from `map-layer` for all 30 centers (~93 zones)
- `provider='nac'`, `country='USA'`, `mountain=center_name` for grouping

**Geocode update**: Remove France bias (`region: "fr"`) from Google Maps geocoding to support US location search.

---

### PR 5: `chore/multi-provider-polish` — UX polish

- Smart country ordering (user's subscribed countries first)
- Seasonal unavailability handling for US zones (Dec–Apr message)
- Update welcome/help messages for multi-country context
- Country flag emojis in browse lists

---

## Dependency Graph

```
PR 1 (foundation) ✅
  ↓
  ├──→ PR 2 (templates) ──→ PR 4 (US NAC) ──┐
  │                                           ├──→ PR 5 (polish)
  └──→ PR 3 (European EAWS) ─────────────────┘
```

PR 2 is blocked on Meta template approval (~24h). PR 3 can proceed immediately after PR 1. PR 4 requires PR 2.

---

## Key Design Decisions

1. **Provider interface** supports both `'pdf'` and `'summary'` delivery modes — the delivery layer branches on this
2. **Content types** stay as-is (7 MF-specific boolean columns) — non-MF providers ignore the extra flags, UI only shows relevant toggles
3. **Region codes** are all strings — `'15'` for French massifs, `'AT-07'` for EAWS, `'BTAC/teton'` for US zones
4. **No PDF generation** for US — text summary + link is simpler and more appropriate for messaging
5. **CAAMLv6 parser** is shared across all European non-French providers
6. **SLF** caches its single-endpoint response per cron run to avoid redundant API calls

---

## WhatsApp Templates

Two new templates replace the existing `bulletin` template. Both use named variables.

### `bulletin_pdf` (PDF providers)

- Header: document (PDF attachment, no text)
- Body: `Region *{{region_name}}*\nValid until *{{date}}*\nRisk level *{{risk_level}}* / 5`
- Footer: `conditionsreport.com`
- Button: quick_reply "Unsubscribe"

```
┌─────────────────────────────────────┐
│  📄 Mont-Blanc 4th Mar 3-5.pdf      │
│                                     │
│  Region *Mont-Blanc*                │
│  Valid until *4th March*            │
│  Risk level *3* / 5                 │
│                                     │
│  conditionsreport.com               │
│                                     │
│  ┌───────────────┐                  │
│  │ Unsubscribe   │                  │
│  └───────────────┘                  │
└─────────────────────────────────────┘
```

### `bulletin_summary` (US / no-PDF providers)

- Header: text `{{massif_name}}`
- Body: `Risk level *{{risk_level}}* / 5\nValid until *{{date}}*\n\n··· {{summary}} ···\n\n_Check {{url}} for details._`
- Footer: `conditionsreport.com`
- Button: quick_reply "Unsubscribe"

```
┌─────────────────────────────────────┐
│  Teton Range                        │
│                                     │
│  Risk level *3* / 5                 │
│  Valid until *4th March*            │
│                                     │
│  ··· Storm slab and wind slab       │
│  problems likely on north-facing    │
│  slopes above treeline. ···         │
│                                     │
│  _Check avalanche.org/forecasts/    │
│  BTAC for details._                 │
│                                     │
│  conditionsreport.com               │
│                                     │
│  ┌───────────────┐                  │
│  │ Unsubscribe   │                  │
│  └───────────────┘                  │
└─────────────────────────────────────┘
```

---

## Verification (per PR)

1. **PR 1** ✅: Cron tested end-to-end — bulletins fetched, stored, and delivered. Massif codes stored as strings (`'15'` not `15`). 35 massifs / 4 mountains / 1 country cached. All Telegram and WhatsApp flows work. Old `bulletin` template still used.
2. **PR 2**: Cron delivers French bulletins using new `bulletin_pdf` template. Verify formatting matches mockup.
3. **PR 3**: Subscribe to AT-07 → receive Euregio PDF via cron. Browse shows countries. French users unaffected.
4. **PR 4**: Search "Jackson Hole" → get forecast summary with link. Cron delivers text summaries using `bulletin_summary` template.
5. **PR 5**: Browse lists show flags, smart ordering works.
