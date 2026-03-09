# Conditions Report — Format Spec & Example

This document is the source of truth for the AI-generated conditions report format. It is referenced by the Claude system prompt in `reportService.ts`.

## Telegram (full report, HTML format, ≤3500 chars)

```
🏔 Mont-Blanc — Conditions Report
📅 Sunday 9th March 2026

⚠️ Avalanche Risk: 3/5 (Considerable)
Persistent slab problem on north-facing slopes above 2200m. Natural
avalanche activity possible on steep slopes, especially during afternoon
warming. Human-triggered avalanches likely on slopes steeper than 30°.

🌡️ Weather
Freezing level: 2400m, rising to 2800m by afternoon
Summit (4807m): -19°C, W winds 45 km/h gusting 65
3000m: -5°C → -2°C, light SW winds
2000m: 3°C → 7°C, calm
Visibility: Good morning, cloud build-up from 14:00
Overnight: 10cm fresh snow above 2500m

❄️ Snow Quality
Above 2500m: Powder from overnight snowfall on north aspects,
wind-affected on ridgelines. South aspects showing crust from
yesterday's freeze-thaw.
2000-2500m: Variable — north still holds dry snow, south aspects
are spring-like with firm morning crust softening by midday.
Below 2000m: Wet, heavy snow. Skiable but deteriorating fast.

⭐ Best Conditions Today
Aspect: North and north-east facing slopes above 2200m
Timing: Early start recommended — skin up from dawn (07:12),
descend before 13:00 as solar warming destabilises south aspects
and the freezing level rises.

🎿 Route Suggestions
• Col du Midi (PD) — N aspect, 2500-3800m. Best pick today:
  sheltered from wind, good powder on the upper section.
• Grand Mulets (PD) — NW aspect, 2300-4300m. Classic but exposed
  to wind above 3500m. Start early.
• Vallée Blanche (F) — Various aspects. Avoid south-facing
  sections after midday.

☀️ Sunrise 07:12 · Sunset 18:41
```

## WhatsApp (template with named variables, each variable is a single line — no newlines)

Template body:
```
*Conditions report for {{massif_name}}*
📅 {{date}}

⚠️ *Avalanche Risk*
{{risk}}

🌡️  *Weather*
{{weather}}

❄️ *Best snow*
{{snow}}

⭐ *Tip*
{{tip}}

_Check being for going out_
```

Buttons:
- [0] "Suggest routes" (payload: `routes:<massif_code>`)
- [1] "Unsubscribe" (payload: `unsub:<massif_code>`)

Example variable values:
| Variable | Example |
|---|---|
| `massif_name` | `Mont-Blanc` |
| `date` | `9th March` |
| `risk` | `3/5 — Persistent slab on N slopes >2200m. Human-triggered avalanches likely.` |
| `weather` | `Freezing level 2400m rising to 2800m. 3000m: -5°C. 10cm fresh snow above 2500m.` |
| `snow` | `N/NE aspects above 2200m — powder from overnight. S aspects crusting by midday.` |
| `tip` | `Early start recommended (sunrise 07:12). Descend before 13:00.` |

## Format Rules (Claude prompt instructions)

- Use emoji section headers as shown above
- Lead with avalanche risk — this is safety-critical
- Be specific about elevations, aspects, and times
- Route suggestions reference CampToCamp routes by name with grade
- Weather uses actual numbers, not vague descriptions
- Short version prioritises safety info and actionable advice
- Friendly but authoritative tone — like a local mountain guide
- Telegram report must be ≤3500 characters (Telegram message limit)
- WhatsApp uses named template variables — each field is a single line, no newlines allowed

## Data Source Mapping

| Section | Data Source |
|---|---|
| Avalanche Risk | BRA XML (`RISQUEMAXI`, stability text) |
| Weather | Open-Meteo API (hourly temps at multiple elevations, wind, precipitation, freezing level) |
| Snow Quality | BRA XML (snow quality description) + Open-Meteo (recent snowfall, freezing level) |
| Best Conditions | Synthesised from weather + avalanche data (aspect, timing, elevation) |
| Route Suggestions | CampToCamp API (ski touring routes near massif) |
| Sunrise/Sunset | Open-Meteo API (daily sun times) |
