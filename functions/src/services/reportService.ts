import Anthropic from "@anthropic-ai/sdk";
import {ANTHROPIC_API_KEY} from "@config/envs";
import {MassifCache} from "@cache/MassifCache";
import {formatError} from "@utils/formatters";
import {Analytics} from "@analytics/Analytics";
import type {WeatherResult} from "@services/weatherService";
import type {RouteInfo} from "@services/routeService";

export type WhatsAppReportFields = {
    risk: string;
    weather: string;
    snow: string;
    tip: string;
};

export type ConditionsReport = {
    fullReport: string;
    whatsapp: WhatsAppReportFields;
};

type ReportInput = {
    massifCode: string;
    massifName: string;
    riskLevel?: number;
    validFrom: Date;
    metadata?: Record<string, any>;
    weather: WeatherResult;
    routes: RouteInfo[];
};

const SYSTEM_PROMPT = `You are a mountain conditions expert writing daily ski touring conditions reports. You synthesise avalanche bulletin data, weather forecasts, and route information into actionable advice for ski tourers.

FORMAT RULES:
- Use emoji section headers exactly as shown below
- Lead with avalanche risk — this is safety-critical
- Be specific about elevations, aspects, and times
- Route suggestions reference routes by name with grade in parentheses
- Weather uses actual numbers, not vague descriptions
- Friendly but authoritative tone — like a local mountain guide
- Do NOT use markdown formatting (no *, **, or #) — output plain text with emoji headers
- Use → for temperature changes (e.g. -5°C → -2°C)

TELEGRAM REPORT SECTIONS (≤3500 chars total):
🏔 {Massif Name} — Conditions Report
📅 {Day of week} {date}

⚠️ Avalanche Risk: {level}/5 ({label})
{Risk description with aspects, elevations, and trigger likelihood}

🌡️ Weather
{Freezing level, temperatures at key elevations, wind, visibility, precipitation}

❄️ Snow Quality
{Snow conditions by elevation band and aspect}

⭐ Best Conditions Today
{Recommended aspect, elevation, and timing with sunrise/sunset}

🎿 Route Suggestions
{2-3 routes with grade, aspect, elevation range, and brief assessment}

☀️ Sunrise {time} · Sunset {time}

WHATSAPP FIELDS (output after ---SHORT--- separator, one field per line, format: FIELD_NAME: value):
Each field must be a single line with NO newlines. These are injected into a WhatsApp template.
- RISK: One-line avalanche risk summary (e.g. "3/5 — Persistent slab on N slopes >2200m. Human-triggered avalanches likely.")
- WEATHER: Key weather numbers in one line (e.g. "Freezing level 2400m rising to 2800m. 3000m: -5°C. 10cm fresh snow above 2500m.")
- SNOW: Best snow conditions in one line (e.g. "N/NE aspects above 2200m — powder from overnight. S aspects crusting by midday.")
- TIP: Timing or safety tip in one line (e.g. "Early start recommended (sunrise 07:12). Descend before 13:00.")`;

const RISK_LABELS: Record<number, string> = {
    1: "Low",
    2: "Moderate",
    3: "Considerable",
    4: "High",
    5: "Very High",
};

export namespace ReportService {

    export async function generateReport(input: ReportInput): Promise<ConditionsReport> {
        const client = new Anthropic({apiKey: ANTHROPIC_API_KEY});

        const userPrompt = buildUserPrompt(input);

        try {
            const response = await client.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2000,
                temperature: 0.3,
                system: SYSTEM_PROMPT,
                messages: [{role: "user", content: userPrompt}],
            });

            const text = response.content
                .filter((block: Anthropic.ContentBlock) => block.type === "text")
                .map((block: Anthropic.ContentBlock) => (block as Anthropic.TextBlock).text)
                .join("\n");

            // Split into full report and WhatsApp fields
            const parts = text.split(/---SHORT---/i);
            const fullReport = (parts[0] || text).trim();
            const whatsapp = parseWhatsAppFields(parts[1] || '', fullReport);

            // Enforce Telegram character limit
            const truncatedFull = fullReport.length > 3500
                ? fullReport.substring(0, 3497) + "..."
                : fullReport;

            return {fullReport: truncatedFull, whatsapp};
        } catch (error) {
            console.error(`Failed to generate report for ${input.massifName}: ${formatError(error)}`);

            await Analytics.sendError(
                error as Error,
                `ReportService.generateReport: ${input.massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    function buildUserPrompt(input: ReportInput): string {
        const {massifName, riskLevel, validFrom, metadata, weather, routes} = input;

        const date = validFrom.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Europe/Paris',
        });

        const riskLabel = riskLevel ? RISK_LABELS[riskLevel] || `Level ${riskLevel}` : "Unknown";

        let prompt = `Generate a conditions report for **${massifName}** on **${date}**.

AVALANCHE DATA:
- Risk level: ${riskLevel ?? 'Unknown'}/5 (${riskLabel})`;

        if (metadata?.snowStability) {
            prompt += `\n- Snow stability: ${metadata.snowStability}`;
        }
        if (metadata?.snowQuality) {
            prompt += `\n- Snow quality: ${metadata.snowQuality}`;
        }
        if (metadata?.freezingLevel) {
            prompt += `\n- Freezing level from bulletin: ${metadata.freezingLevel}m`;
        }
        if (metadata?.windDescription) {
            prompt += `\n- Wind: ${metadata.windDescription}`;
        }
        if (metadata?.precipitationForecast) {
            prompt += `\n- Precipitation forecast: ${metadata.precipitationForecast}`;
        }

        // Weather data
        prompt += `\n\nWEATHER DATA:`;
        prompt += `\n- Sunrise: ${formatTime(weather.sunrise)}`;
        prompt += `\n- Sunset: ${formatTime(weather.sunset)}`;
        prompt += `\n- Daily snowfall: ${weather.dailySnowfallCm}cm`;

        // Freezing levels throughout the day
        if (weather.freezingLevelM.length > 0) {
            const morningFL = weather.freezingLevelM[8] ?? weather.freezingLevelM[0];
            const afternoonFL = weather.freezingLevelM[14] ?? weather.freezingLevelM[weather.freezingLevelM.length - 1];
            prompt += `\n- Freezing level: ${Math.round(morningFL)}m morning, ${Math.round(afternoonFL)}m afternoon`;
        }

        // Temperatures at key hours for each elevation
        const keyHours = [6, 9, 12, 15];
        for (const hour of weather.hourly.filter((_, i) => keyHours.includes(i))) {
            prompt += `\n- ${hour.time}:`;
            for (const [elev, data] of Object.entries(hour.elevations)) {
                prompt += ` ${elev}m=${data.temperatureC}°C wind=${data.windSpeedKmh}km/h;`;
            }
            prompt += ` cloud=${hour.cloudCoverPercent}% precip=${hour.precipitationMm}mm`;
        }

        // Route data
        if (routes.length > 0) {
            prompt += `\n\nAVAILABLE ROUTES (from CampToCamp):`;
            for (const route of routes.slice(0, 8)) {
                prompt += `\n- ${route.name} (${route.difficulty || '?'})`;
                if (route.elevationMin || route.elevationMax) {
                    prompt += ` — ${route.elevationMin ?? '?'}m to ${route.elevationMax ?? '?'}m`;
                }
                if (route.aspects?.length) {
                    prompt += ` — ${route.aspects.join('/')} aspect`;
                }
            }
        } else {
            prompt += `\n\nNo route data available — skip the route suggestions section.`;
        }

        prompt += `\n\nGenerate the FULL Telegram report first (≤3500 chars), then output the separator "---SHORT---" on its own line, then the 4 WhatsApp fields (RISK, WEATHER, SNOW, TIP), each on its own line as "FIELD: value".`;

        return prompt;
    }

    function formatTime(isoTime: string): string {
        if (!isoTime) return "N/A";
        try {
            const date = new Date(isoTime);
            return date.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Paris',
            });
        } catch {
            return isoTime;
        }
    }

    function parseWhatsAppFields(fieldsText: string, fullReport: string): WhatsAppReportFields {
        const lines = fieldsText.trim().split('\n');
        const fields: Record<string, string> = {};
        for (const line of lines) {
            const match = line.match(/^(RISK|WEATHER|SNOW|TIP|ROUTE):\s*(.+)$/i);
            if (match) {
                fields[match[1].toLowerCase()] = match[2].trim();
            }
        }

        // Fallback: extract from full report if Claude didn't produce structured fields
        return {
            risk: fields.risk || extractAfterEmoji(fullReport, '⚠️'),
            weather: fields.weather || extractAfterEmoji(fullReport, '🌡️'),
            snow: fields.snow || extractAfterEmoji(fullReport, '❄️'),
            tip: fields.tip || extractAfterEmoji(fullReport, '⭐'),
        };
    }

    function extractAfterEmoji(text: string, emoji: string): string {
        const idx = text.indexOf(emoji);
        if (idx === -1) return '';
        const afterEmoji = text.substring(idx + emoji.length);
        const firstLine = afterEmoji.split('\n').find(l => l.trim().length > 0);
        return (firstLine || '').trim().replace(/^[^a-zA-Z0-9]*/, '');
    }
}
