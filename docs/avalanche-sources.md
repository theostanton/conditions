# Avalanche Bulletin Sources

Reference for evaluating and integrating avalanche bulletin providers across the European Alps.

## Integration Requirements

What we need from a bulletin source to integrate it into conditions:

| Requirement | Description | Priority |
|---|---|---|
| **Bulletin document** | Downloadable PDF (or image) to send via WhatsApp | Required |
| **Danger rating** | Numeric risk level (1–5 EAWS scale) | Required |
| **Validity period** | `valid_from` and `valid_to` timestamps | Required |
| **Region definitions** | Region codes + human-readable names | Required |
| **Region geometry** | GeoJSON polygons for geolocation-based lookup | Nice to have |
| **Programmatic access** | REST API or static file URLs fetchable by cron | Required |
| **Free / open access** | No commercial license or paid API key | Required |
| **Supplementary images** | Snow reports, slope roses, weather graphics, etc. | Nice to have |
| **English language** | Bulletin text or at minimum metadata in English | Nice to have |

## Sources

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

## Notes

- **CAAMLv6** is the EAWS standard — Switzerland, Austria, and Italy all use it. A single CAAMLv6 parser would cover all non-French sources.
- **EAWS region geodata** (GeoJSON for all micro-regions) is available at [gitlab.com/eaws/eaws-regions](https://gitlab.com/eaws/eaws-regions) under CC0, covering all countries.
- **pyAvaCore** ([gitlab.com/albina-euregio/pyAvaCore](https://gitlab.com/albina-euregio/pyAvaCore)) is a Python library that aggregates bulletins from all these services — useful as a reference for endpoint patterns.
- **AINEVA** URL discovery is the main challenge for Italy — the directory structure uses publication timestamps that aren't predictable. South Tyrol and Trentino are easier since they're also on `static.avalanche.report`.
- **avalanche.report** and **lawinen-warnung.eu** share the same ALBINA codebase ([github.com/albina-euregio/albina-server](https://github.com/albina-euregio/albina-server)) — their URL patterns and data formats are identical.
