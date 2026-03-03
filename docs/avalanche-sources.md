# Avalanche Bulletin Sources

Reference for evaluating and integrating avalanche bulletin providers.

## Integration Requirements

What we need from a bulletin source to integrate it into conditions:

| Requirement | Description | Priority |
|---|---|---|
| **Bulletin document** | Downloadable PDF (or image) to send via WhatsApp | Required |
| **Danger rating** | Numeric risk level (1–5 scale) | Required |
| **Validity period** | `valid_from` and `valid_to` timestamps | Required |
| **Region definitions** | Region codes + human-readable names | Required |
| **Region geometry** | GeoJSON polygons for geolocation-based lookup | Nice to have |
| **Programmatic access** | REST API or static file URLs fetchable by cron | Required |
| **Free / open access** | No commercial license or paid API key | Required |
| **Supplementary images** | Snow reports, slope roses, weather graphics, etc. | Nice to have |
| **English language** | Bulletin text or at minimum metadata in English | Nice to have |

## European Sources

| | Météo-France | SLF (Switzerland) | avalanche.report (Euregio) | lawinen-warnung.eu (Austria) | AINEVA (Italy) |
|---|---|---|---|---|---|
| **Status** | Integrated | Candidate | Candidate | Candidate | Candidate |
| **Coverage** | All French Alpine massifs | All Swiss Alps | Tyrol (AT), South Tyrol + Trentino (IT) | Salzburg, Styria, Carinthia, Vorarlberg, Upper/Lower Austria, + Bavaria (DE), Slovenia | All Italian Alpine regions (Piedmont, Aosta, Lombardy, Veneto, Friuli, etc.) |
| **Region codes** | Numeric (Météo-France specific) | SLF-specific | EAWS (e.g. `AT-07`, `IT-32-BZ`) | EAWS (e.g. `AT-05`, `AT-08`) | EAWS (e.g. `IT-21`, `IT-25`) |
| **Data format** | XML metadata + PDF | CAAMLv6 JSON/GeoJSON | CAAMLv6 JSON/XML | CAAMLv6 JSON/XML | CAAMLv6 JSON/XML |
| **Bulletin PDF** | Yes (direct endpoint) | Yes (via `/api/bulletin/document/`) | Yes (static CDN) | Yes (static CDN + admin endpoint) | Yes (static files) |
| **Danger rating** | Yes (XML `RISQUEMAXI`) | Yes (CAAMLv6 `mainValue`) | Yes (CAAMLv6 `mainValue`) | Yes (CAAMLv6 `mainValue`) | Yes (CAAMLv6 `mainValue`) |
| **Validity period** | Yes (XML attributes) | Yes (CAAMLv6 `validTime`) | Yes (CAAMLv6 `validTime`) | Yes (CAAMLv6 `validTime`) | Yes (CAAMLv6 `validTime`) |
| **Supplementary images** | Yes (7 image types) | Unknown | Maps available | Maps available | Maps available |
| **Region geometry** | Custom GeoJSON | Via `/api/warningregion/` GeoJSON | Via EAWS regions geodata | Via EAWS regions geodata | Via EAWS regions geodata |
| **Auth** | API key (`apikey` header) | None | None | None | None |
| **License** | Free (registration required) | CC BY 4.0 | Open data | Open data | Open data |
| **Languages** | `fr` | `de`, `fr`, `it`, `en` | `de`, `en`, `it`, `fr`, `es`, `ca`, `oc` | `de`, `en` (some `it`, `sl`) | `de`, `en`, `fr`, `it` |
| **URL pattern** | REST API with query params | REST API (OpenAPI documented) | Static CDN: `static.avalanche.report/bulletins/latest/{REGION}_{lang}_CAAMLv6.json` | Static CDN: `static.lawinen-warnung.eu/bulletins/latest/{REGION}_{lang}_CAAMLv6.json` | Directory listing: `bollettini.aineva.it/albina_files/{date}/{datetime}/` |
| **URL predictability** | High | High | High | High | Low (requires timestamp discovery) |
| **Docs** | Developer portal | [OpenAPI spec](https://aws.slf.ch/api/bulletin/caaml) | [Open data page](https://avalanche.report/more/open-data) | Same codebase as avalanche.report | None found |

## USA Sources

| | avalanche.org (NAC) | UAC (Utah) | NWAC (Northwest) | CAIC (Colorado) |
|---|---|---|---|---|
| **Status** | Candidate | Candidate | Candidate | Candidate |
| **Coverage** | All US avalanche forecast zones (~21 centers, ~10 states: AK, WA, OR, CA, MT, ID, WY, CO, UT, NH + AZ, NM) | Utah (Logan, Ogden, Salt Lake, Provo, Skyline, Moab, Abajos, Uintas) | Washington + Oregon (Stevens Pass, Snoqualmie, Mt Hood, Olympics, East/West Slopes) | All Colorado zones (~14 forecast zones with dynamic boundaries) |
| **Region codes** | `{center_id}` + `{zone_id}` (e.g. `NWAC/stevens-pass`, `BTAC/teton`) | Slug-based (e.g. `salt-lake`, `logan`, `ogden`) | Slug-based (e.g. `stevens-pass`, `mt-hood`) | Internal zone IDs |
| **Data format** | Proprietary JSON + GeoJSON (not CAAMLv6) | Proprietary JSON | Via avalanche.org JSON API | Via avalanche.org JSON API |
| **Bulletin PDF** | No — forecasts are HTML only | No — HTML only | No — HTML only | No — HTML only |
| **Danger rating** | Yes — 1–5 North American scale with elevation bands (`lower`/`middle`/`upper`) | Yes — 1–5 scale | Yes — 1–5 scale with elevation bands | Yes — 1–5 scale with elevation bands |
| **Validity period** | Yes (`start_date`/`end_date` on each zone) | Yes (`start_date`/`end_date`) | Yes (`start_date`/`end_date`) | Yes (`start_date`/`end_date`) |
| **Supplementary images** | No | No | No | No |
| **Region geometry** | Yes — GeoJSON polygons in `map-layer` response | Via avalanche.org map-layer | Via avalanche.org map-layer | Via avalanche.org map-layer |
| **Auth** | None | None (asks for User-Agent with contact email) | None (via avalanche.org) | None (via avalanche.org) |
| **License** | Public (US Forest Service / government partnership) | Public | Public | Public (state government) |
| **Languages** | `en` | `en` | `en` | `en` |
| **URL pattern** | Map layer: `api.avalanche.org/v2/public/products/map-layer/{center_id}` Products: `api.avalanche.org/v2/public/products?avalanche_center_id={id}&date_start=...&date_end=...` | `utahavalanchecenter.org/forecast/{region}/json` | Via avalanche.org products API | Via avalanche.org products API |
| **URL predictability** | High | High | High | High |
| **Docs** | [GitHub: Public API Docs](https://github.com/NationalAvalancheCenter/Avalanche.org-Public-API-Docs) | [Forecast JSON docs](https://utahavalanchecenter.org/docs/api/forecast) | None (use avalanche.org) | None (`caic-python` [unofficial client](https://github.com/gormaniac/caic-python) available) |

### US Avalanche Centers on avalanche.org

The National Avalanche Center (NAC) operates a unified platform at avalanche.org that aggregates forecasts from all US avalanche centers. A single API call to the `map-layer` endpoint returns GeoJSON with danger ratings and zone polygons for the entire country.

| Center ID | Name | State(s) |
|---|---|---|
| BTAC | Bridger-Teton Avalanche Center | WY |
| CAIC | Colorado Avalanche Information Center | CO |
| CNFAIC | Chugach National Forest Avalanche Center | AK |
| CAAC | Alaska Avalanche Center | AK |
| COAA | Central Oregon Avalanche Association | OR |
| BAC | Bridgeport Avalanche Center | CA |
| EARAC | Eastern Alaska Range Avalanche Center | AK |
| ESAC | Eastern Sierra Avalanche Center | CA |
| FAC | Flathead Avalanche Center | MT |
| GNFAC | Gallatin National Forest Avalanche Center | MT |
| HAC | Haines Avalanche Center | AK |
| HPAC | Hatcher Pass Avalanche Center | AK |
| IPAC | Idaho Panhandle Avalanche Center | ID |
| KPAC | Kachina Peaks Avalanche Center | AZ |
| MSAC | Mount Shasta Avalanche Center | CA |
| MWAC | Mount Washington Avalanche Center | NH |
| NWAC | Northwest Avalanche Center | WA, OR |
| SAC | Sierra Avalanche Center | CA |
| SNFAC | Sawtooth National Forest Avalanche Center | ID |
| SPAC | Shasta-area/Payette Avalanche Center | ID |
| UTAC | Utah Avalanche Center | UT |
| WCMAC | West Central Montana Avalanche Center | MT |
| TAC | Taos Avalanche Center | NM |
| PAC | Payette Avalanche Center | ID |

### US Integration Assessment

**What works well:**
- Single API covering all US centers — only one provider to integrate
- Free public data, no auth required
- GeoJSON zone polygons included in API response — geolocation lookup is straightforward
- Danger ratings use the same 1–5 scale as EAWS
- Elevation-banded danger (`lower`/`middle`/`upper`) is more granular than European max-only ratings
- `start_date`/`end_date` validity on every zone
- Forecasts updated daily during winter season (typically Dec–Apr, 6–10 AM Mountain Time)

**Blockers and challenges:**
- **No PDF bulletins** — US forecasts are HTML web pages, not downloadable PDFs. This is the primary blocker since the current system delivers PDFs via WhatsApp. Options:
  1. Generate PDF from the forecast HTML using headless rendering (Puppeteer/Playwright)
  2. Send forecast summary text + link to the full web forecast instead of PDF
  3. Screenshot the forecast page and send as image
- **Not CAAMLv6** — Requires a new parser for the avalanche.org JSON format (separate from the European CAAMLv6 parser)
- **No supplementary images** — Unlike Météo-France, US providers don't offer slope roses, snow reports, or weather graphics via API
- **Seasonal availability** — Forecasts are only published during winter season (~Dec–Apr), and timing varies by center
- **HTML `bottom_line` field** — The forecast text is HTML-formatted; needs stripping or rendering for WhatsApp delivery
- **Some centers publish summaries without danger ratings** — These show `danger_level: -1` ("no rating")

**Recommended approach:** Integrate avalanche.org as a single `nac` provider using the `map-layer` endpoint for metadata + danger ratings and the `products` endpoint for forecast content. For bulletin delivery, send a danger rating summary with a link to the full web forecast rather than attempting PDF generation, since the HTML forecasts don't map cleanly to a single-page PDF format.

## Notes

### European

- **CAAMLv6** is the EAWS standard — Switzerland, Austria, and Italy all use it. A single CAAMLv6 parser would cover all non-French sources.
- **EAWS region geodata** (GeoJSON for all micro-regions) is available at [gitlab.com/eaws/eaws-regions](https://gitlab.com/eaws/eaws-regions) under CC0, covering all countries.
- **pyAvaCore** ([gitlab.com/albina-euregio/pyAvaCore](https://gitlab.com/albina-euregio/pyAvaCore)) is a Python library that aggregates bulletins from all these services — useful as a reference for endpoint patterns.
- **AINEVA** URL discovery is the main challenge for Italy — the directory structure uses publication timestamps that aren't predictable. South Tyrol and Trentino are easier since they're also on `static.avalanche.report`.
- **avalanche.report** and **lawinen-warnung.eu** share the same ALBINA codebase ([github.com/albina-euregio/albina-server](https://github.com/albina-euregio/albina-server)) — their URL patterns and data formats are identical.

### USA

- **avalanche.org** is a partnership between the American Avalanche Association (A3) and the US Forest Service National Avalanche Center (NAC). The shared platform was built by [Snowbound Solutions](https://snowboundsolutions.com/project/shared-avalanche-forecasting-platform/) starting in 2015.
- **North American Avalanche Danger Scale** uses the same 1–5 levels as EAWS: Low, Moderate, Considerable, High, Extreme. The scale is functionally identical for integration purposes.
- **Elevation-banded danger** — US forecasts provide separate danger ratings for `lower`, `middle`, and `upper` elevation bands. The `danger_rating` field on the product is the overall max. For display, consider showing the max or the most relevant band for the user's intended elevation.
- **UAC** has its own [documented JSON API](https://utahavalanchecenter.org/docs/api/forecast) that returns richer forecast data than the avalanche.org products endpoint. Could be used as a supplementary source for Utah zones.
- **CAIC** uses "dynamic forecast zones" that can change boundaries based on conditions — a unique feature among US centers. Their zones are available via the avalanche.org map-layer endpoint.
- **`caic-python`** ([github.com/gormaniac/caic-python](https://github.com/gormaniac/caic-python)) is an unofficial async Python client for CAIC's undocumented HTTP APIs — useful as a reference for Colorado-specific data patterns.
- **Avalanche Canada** ([docs.avalanche.ca](https://docs.avalanche.ca/)) has a well-documented public Products API that's worth studying for comparison — similar structure to avalanche.org but with better documentation.
