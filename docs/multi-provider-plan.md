# Plan: Integrate European Avalanche Bulletin Providers

## Context

The system currently delivers French avalanche bulletins (Météo-France) via WhatsApp/Telegram. We want to extend coverage to Switzerland (SLF), Austria (avalanche.report + lawinen-warnung.eu), and Italy (AINEVA). The critical blocker: `massifs.code` is `INTEGER` but EAWS region codes are strings like `AT-07`, `IT-32-BZ`.

## PR Structure

Three sequential PRs, each independently deployable:

### PR 1: `refactor/multi-provider-support` — Foundational refactor

**Schema migration** — `scripts/migrate_massif_codes_to_text.sql`:
- Alter `massifs.code`, `bra_subscriptions.massif`, `bras.massif`, `deliveries_bras.massif`, `geocode_cache.massif_code` from `integer` to `text` (using `::text` cast — existing `15` becomes `'15'`)
- Add `provider TEXT NOT NULL DEFAULT 'meteofrance'` and `country TEXT NOT NULL DEFAULT 'France'` columns to `massifs`
- Wrapped in a single transaction

**Type changes** — `functions/src/types/index.ts`:
- `Massif.code`: `number` → `string`
- `Bulletin.massif`: `number` → `string`
- `BulletinDestination.massif`: `number` → `string`
- `Subscription.massif`: `number` → `string`
- Add `provider?: string` and `country?: string` to `Massif`

**Provider abstraction** — new `functions/src/providers/` directory:
- `types.ts` — `BulletinProvider` interface with `fetchBulletinMetadata(regionCode: string)` and `fetchBulletinPdf(regionCode: string, destPath: string)`
- `meteoFranceProvider.ts` — extracts existing Météo-France logic from `bulletinService.ts`
- `registry.ts` — maps provider IDs to instances, resolves provider for a massif via `MassifCache`

**Refactor bulletinService.ts** to be provider-agnostic:
- `checkForNewBulletins()` calls `getProviderForMassif(code)` instead of hardcoded Météo-France API
- `fetchAndStoreBulletins()` delegates PDF fetch to provider, keeps GCS upload as shared logic
- All `number` massif params → `string`

**Cascade type changes** across ~20 files (mechanical `number` → `string`):
- `database/queries.ts`, `database/models/Bulletins.ts`, `Subscriptions.ts`, `Deliveries.ts`, `Massifs.ts`, `GeocodeCache.ts`
- `services/imageService.ts`, `services/contentDeliveryService.ts` — add provider guard (skip images for non-Météo-France)
- `cache/MassifCache.ts` — `findByCode(code: string)`, add `getCountries()` + `getByCountry()`
- `whatsapp/router.ts` — remove `parseInt()` from callback parsing (`br:mas:AT-07` needs string, not number)
- `whatsapp/flows/bulletin.ts`, `whatsapp/flows/delivery.ts`
- `bot/commands/get.ts`, `bot/commands/subscriptions.ts`, `bot/actions/subscriptions.ts`
- `scripts/update_massifs.ts` — cast code to string, set `provider: 'meteofrance'`
- `cron/index.ts`, `cron/services/notificationService.ts`, `whatsapp/services/notificationService.ts`
- Update `database/schema.sql` to match new schema

---

### PR 2: `feat/euregio-austria-providers` — avalanche.report + lawinen-warnung.eu

**Shared EAWS provider** — `functions/src/providers/eawsProvider.ts`:
- Generic provider taking `(id, baseUrl, lang)` — two instances with different hosts
- Metadata: `GET ${baseUrl}/bulletins/latest/${regionCode}_${lang}_CAAMLv6.json`
- PDF: `GET ${baseUrl}/bulletins/latest/${regionCode}_${lang}.pdf`

**CAAMLv6 parser** — `functions/src/providers/caaml/parser.ts`:
- Parses `validTime.startTime`/`endTime` and max `dangerRatings[].mainValue` from CAAMLv6 JSON

**Register providers** in `registry.ts`:
```
new EawsProvider('euregio', 'https://static.avalanche.report', 'en')
new EawsProvider('lawinen', 'https://static.lawinen-warnung.eu', 'en')
```

**Seed regions** — `scripts/update_eaws_regions.ts`:
- AT-07 (Tyrol), IT-32-BZ (South Tyrol), IT-32-TN (Trentino) → provider `euregio`
- AT-02 to AT-08, DE-BY, SI → provider `lawinen`
- Each with `country` and `mountain` fields

**Browse flow update** — add country selection layer:
- `br:cty:{country}` → shows regions in that country
- France keeps existing mountain → massif flow
- Other countries go directly to region list (each region is its own "massif")

---

### PR 3: `feat/slf-switzerland` — SLF (Switzerland)

**SLF provider** — `functions/src/providers/slfProvider.ts`:
- Metadata: `GET https://aws.slf.ch/api/bulletin/caaml/en/json` (returns ALL regions in one response — cache and extract per-region)
- PDF: `GET https://aws.slf.ch/api/bulletin/document/`
- Reuses CAAMLv6 parser from PR 2

**Seed Swiss regions** — `scripts/update_slf_regions.ts`

**Register** in `registry.ts`: `new SlfProvider()`

---

## Verification

After each PR:
1. Run `scripts/update_massifs.ts` — confirm French massifs load correctly
2. Trigger a cron run — bulletins fetched, stored in GCS, metadata in DB
3. WhatsApp: send a place name → get bulletin, browse flow works, subscribe/unsubscribe works
4. Telegram: same flows work
5. Check callback IDs with string codes don't break (`br:mas:AT-07`, `unsub:AT-07`)

For PR 1 specifically: the system should behave **identically** to before — the only difference is codes stored as `'15'` instead of `15`.
