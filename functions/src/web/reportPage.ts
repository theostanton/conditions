import type {Massif, Bulletin} from "@app-types";
import type {ConditionsReport} from "@services/reportService";

const WA_NUMBER = '33685594288';

const RISK_LABELS: Record<number, string> = {
    1: 'Low',
    2: 'Moderate',
    3: 'Considerable',
    4: 'High',
    5: 'Very High',
};

// Emoji headers used in the full report, mapped to card styles
const SECTION_CONFIG: {emoji: string; label: string; color: string}[] = [
    {emoji: '\u26A0\uFE0F', label: 'Avalanche Risk', color: '#ef4444'},
    {emoji: '\uD83C\uDF21\uFE0F', label: 'Weather', color: '#3b82f6'},
    {emoji: '\u2744\uFE0F', label: 'Snow Quality', color: '#a5b4fc'},
    {emoji: '\u2B50', label: 'Best Conditions', color: '#eab308'},
    {emoji: '\uD83C\uDFBF', label: 'Route Suggestions', color: '#22c55e'},
    {emoji: '\u2600\uFE0F', label: 'Sunrise / Sunset', color: '#f97316'},
];

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function baseStyles(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #111827;
            min-height: 100vh;
            color: #fafafa;
            padding: 0;
        }
        body::before {
            content: '';
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -55%);
            width: 800px; height: 600px;
            background: radial-gradient(ellipse, rgba(56, 120, 200, 0.07) 0%, transparent 70%);
            pointer-events: none;
            z-index: 0;
        }
        a { color: #60a5fa; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .container {
            max-width: 680px;
            margin: 0 auto;
            padding: 48px 24px;
            position: relative;
            z-index: 1;
        }
        .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            color: #a1a1aa;
            margin-bottom: 32px;
        }
        .back-link:hover { color: #fafafa; text-decoration: none; }
        header { margin-bottom: 36px; }
        header h1 {
            font-size: 32px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 6px;
        }
        header .date {
            font-size: 15px;
            color: #a1a1aa;
        }
        header .risk-badge {
            display: inline-block;
            margin-top: 12px;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
        }
        .card {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
        }
        .card-header {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-body {
            font-size: 14px;
            line-height: 1.7;
            color: #d4d4d8;
            white-space: pre-wrap;
        }
        .cta-section {
            margin-top: 40px;
            text-align: center;
            padding: 32px 24px;
            background: rgba(34, 197, 94, 0.06);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 12px;
        }
        .cta-section h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .cta-section p {
            font-size: 14px;
            color: #a1a1aa;
            margin-bottom: 20px;
        }
        .wa-button {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-size: 15px;
            font-weight: 500;
            padding: 12px 28px;
            border-radius: 10px;
            text-decoration: none;
            background: rgba(34, 197, 94, 0.12);
            border: 1px solid rgba(34, 197, 94, 0.4);
            color: #22c55e;
            transition: all 150ms ease;
        }
        .wa-button:hover {
            background: rgba(34, 197, 94, 0.2);
            text-decoration: none;
        }
        .wa-button svg { width: 20px; height: 20px; flex-shrink: 0; }
        footer {
            margin-top: 48px;
            text-align: center;
            font-size: 13px;
            color: #52525b;
            padding-bottom: 24px;
        }
        footer a { color: #71717a; }
        footer a:hover { color: #a1a1aa; }
        @media (max-width: 600px) {
            .container { padding: 32px 16px; }
            header h1 { font-size: 26px; }
        }
    `;
}

function whatsappSvg(): string {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
}

function wrapHtml(title: string, description: string, body: string, options?: {refreshSeconds?: number}): string {
    const refreshTag = options?.refreshSeconds
        ? `<meta http-equiv="refresh" content="${options.refreshSeconds}">`
        : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <title>${escapeHtml(title)}</title>
    <link rel="icon" type="image/png" href="/avatar.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    ${refreshTag}
    <style>${baseStyles()}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function parseReportSections(fullReport: string): {emoji: string; label: string; color: string; content: string}[] {
    const sections: {emoji: string; label: string; color: string; content: string}[] = [];

    for (const config of SECTION_CONFIG) {
        const idx = fullReport.indexOf(config.emoji);
        if (idx === -1) continue;

        // Find the start of content (after the header line)
        const headerEnd = fullReport.indexOf('\n', idx);
        if (headerEnd === -1) continue;

        // Find the end (next section emoji or end of text)
        let endIdx = fullReport.length;
        for (const other of SECTION_CONFIG) {
            if (other.emoji === config.emoji) continue;
            const otherIdx = fullReport.indexOf(other.emoji, headerEnd);
            if (otherIdx !== -1 && otherIdx < endIdx) {
                endIdx = otherIdx;
            }
        }

        const content = fullReport.substring(headerEnd + 1, endIdx).trim();
        if (content) {
            sections.push({...config, content});
        }
    }

    return sections;
}

function riskBadgeStyle(level: number): string {
    if (level >= 4) return 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
    if (level === 3) return 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);';
    if (level === 2) return 'background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3);';
    return 'background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);';
}

export function renderReportPage(massif: Massif, report: ConditionsReport, bulletin: Bulletin): string {
    const dateStr = bulletin.valid_from.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris',
    });

    const riskLevel = bulletin.risk_level;
    const riskLabel = riskLevel ? RISK_LABELS[riskLevel] : undefined;
    const title = `${massif.name} Conditions Report`;
    const description = riskLevel
        ? `${massif.name} ski touring conditions — Avalanche risk ${riskLevel}/5 (${riskLabel})`
        : `${massif.name} ski touring conditions report`;

    const sections = parseReportSections(report.fullReport);

    const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(massif.name)}`;

    let cardsHtml = '';
    for (const section of sections) {
        cardsHtml += `
        <div class="card">
            <div class="card-header" style="color: ${section.color};">
                <span>${section.emoji}</span> ${escapeHtml(section.label)}
            </div>
            <div class="card-body">${escapeHtml(section.content)}</div>
        </div>`;
    }

    const riskBadgeHtml = riskLevel
        ? `<span class="risk-badge" style="${riskBadgeStyle(riskLevel)}">Avalanche Risk: ${escapeHtml(String(riskLevel))}/5 ${riskLabel ? `(${escapeHtml(riskLabel)})` : ''}</span>`
        : '';

    const body = `
    <div class="container">
        <a href="/" class="back-link">&larr; conditionsreport.com</a>
        <header>
            <h1>${escapeHtml(massif.name)}</h1>
            <div class="date">${escapeHtml(dateStr)}</div>
            ${riskBadgeHtml}
        </header>
        ${cardsHtml}
        <div class="cta-section">
            <h2>Get this report daily</h2>
            <p>Receive ${escapeHtml(massif.name)} conditions every morning on WhatsApp</p>
            <a href="${waLink}" class="wa-button" target="_blank" rel="noopener">
                ${whatsappSvg()}
                Send to me on WhatsApp
            </a>
        </div>
        <footer>
            <a href="/">conditionsreport.com</a> &middot; built by <a href="https://theo.dev" target="_blank" rel="noopener">theo.dev</a>
        </footer>
    </div>`;

    return wrapHtml(title, description, body);
}

export function renderLoadingPage(massif: Massif): string {
    const title = `${massif.name} — Preparing Report`;
    const description = `Generating conditions report for ${massif.name}...`;

    const body = `
    <div class="container" style="text-align: center; padding-top: 120px;">
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
            .spinner {
                width: 40px; height: 40px;
                border: 3px solid rgba(255,255,255,0.1);
                border-top-color: #60a5fa;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 24px;
            }
        </style>
        <div class="spinner"></div>
        <h1 style="font-size: 22px; margin-bottom: 8px;">Preparing report</h1>
        <p style="color: #a1a1aa; font-size: 15px;">${escapeHtml(massif.name)} conditions report is being generated...</p>
    </div>`;

    return wrapHtml(title, description, body, {refreshSeconds: 3});
}

export function renderNotAvailablePage(massif: Massif): string {
    const title = `${massif.name} — No Report Available`;
    const description = `No avalanche bulletin currently available for ${massif.name}`;

    const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(massif.name)}`;

    const body = `
    <div class="container" style="text-align: center; padding-top: 80px;">
        <a href="/" class="back-link">&larr; conditionsreport.com</a>
        <h1 style="font-size: 26px; margin-bottom: 12px;">${escapeHtml(massif.name)}</h1>
        <p style="color: #a1a1aa; font-size: 15px; margin-bottom: 32px;">
            No avalanche bulletin is currently available for this massif.<br>
            Bulletins are typically published during the winter season.
        </p>
        <a href="${waLink}" class="wa-button" target="_blank" rel="noopener">
            ${whatsappSvg()}
            Get notified on WhatsApp
        </a>
        <footer>
            <a href="/">conditionsreport.com</a> &middot; built by <a href="https://theo.dev" target="_blank" rel="noopener">theo.dev</a>
        </footer>
    </div>`;

    return wrapHtml(title, description, body);
}
