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

// Section config — order matters. Sunrise is rendered inline, not as a card.
const SECTION_CONFIG: {emoji: string; key: string; label: string; color: string}[] = [
    {emoji: '\u26A0\uFE0F', key: 'risk', label: 'Avalanche Risk', color: '#ef4444'},
    {emoji: '\uD83C\uDF21\uFE0F', key: 'weather', label: 'Weather', color: '#60a5fa'},
    {emoji: '\u2744\uFE0F', key: 'snow', label: 'Snow Conditions', color: '#c4b5fd'},
    {emoji: '\u2B50', key: 'best', label: 'Best Conditions', color: '#fbbf24'},
    {emoji: '\uD83C\uDFBF', key: 'routes', label: 'Routes', color: '#34d399'},
    {emoji: '\u2600\uFE0F', key: 'sun', label: 'Sunrise / Sunset', color: '#fb923c'},
];

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function riskColor(level: number): string {
    if (level >= 4) return '#ef4444';
    if (level === 3) return '#f59e0b';
    if (level === 2) return '#eab308';
    return '#22c55e';
}

function baseStyles(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            min-height: 100vh;
            color: #e2e8f0;
            -webkit-font-smoothing: antialiased;
        }

        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .container {
            max-width: 620px;
            margin: 0 auto;
            padding: 40px 20px 32px;
        }

        /* Nav */
        nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
            animation: fadeUp 0.4s ease-out both;
        }
        nav a {
            font-size: 13px;
            color: #64748b;
            text-decoration: none;
            transition: color 150ms;
        }
        nav a:hover { color: #94a3b8; }
        .nav-date { font-size: 13px; color: #475569; }

        /* Header */
        .report-header {
            margin-bottom: 28px;
            animation: fadeUp 0.4s ease-out 0.05s both;
        }
        .report-header h1 {
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.03em;
            color: #f8fafc;
            line-height: 1.2;
        }

        /* Risk hero */
        .risk-hero {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 24px;
            animation: fadeUp 0.4s ease-out 0.1s both;
        }
        .risk-number {
            font-size: 48px;
            font-weight: 600;
            letter-spacing: -0.04em;
            line-height: 1;
        }
        .risk-number span {
            font-size: 20px;
            opacity: 0.5;
            font-weight: 400;
        }
        .risk-detail { flex: 1; min-width: 0; }
        .risk-label {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }
        .risk-desc {
            font-size: 13px;
            line-height: 1.6;
            opacity: 0.8;
        }

        /* Section */
        .section {
            border-left: 3px solid;
            padding: 0 0 0 16px;
            margin-bottom: 20px;
        }
        .section-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 6px;
        }
        .section-body {
            font-size: 14px;
            line-height: 1.65;
            color: #cbd5e1;
            white-space: pre-wrap;
        }

        /* Sunrise bar */
        .sun-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 24px;
            padding: 12px 0;
            margin: 4px 0 24px;
            font-size: 13px;
            color: #64748b;
            border-top: 1px solid rgba(255,255,255,0.06);
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sun-bar span { color: #94a3b8; }

        /* CTA */
        .cta {
            margin-top: 36px;
            padding: 28px 24px;
            text-align: center;
            border: 1px solid rgba(34, 197, 94, 0.15);
            border-radius: 10px;
            background: rgba(34, 197, 94, 0.04);
        }
        .cta p {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 16px;
        }
        .cta p strong { color: #94a3b8; font-weight: 500; }
        .wa-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
            padding: 10px 24px;
            border-radius: 8px;
            text-decoration: none;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #4ade80;
            transition: all 150ms;
        }
        .wa-btn:hover {
            background: rgba(34, 197, 94, 0.18);
            border-color: rgba(34, 197, 94, 0.5);
            text-decoration: none;
        }
        .wa-btn svg { width: 18px; height: 18px; flex-shrink: 0; }

        /* Footer */
        footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.04);
            text-align: center;
            font-size: 12px;
            color: #334155;
        }
        footer a { color: #475569; text-decoration: none; }
        footer a:hover { color: #64748b; }

        @media (max-width: 600px) {
            .container { padding: 24px 16px 24px; }
            .report-header h1 { font-size: 24px; }
            .risk-hero { gap: 16px; padding: 16px; }
            .risk-number { font-size: 40px; }
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

function parseReportSections(fullReport: string): {key: string; emoji: string; label: string; color: string; content: string}[] {
    const sections: {key: string; emoji: string; label: string; color: string; content: string}[] = [];

    for (const config of SECTION_CONFIG) {
        const idx = fullReport.indexOf(config.emoji);
        if (idx === -1) continue;

        const headerEnd = fullReport.indexOf('\n', idx);
        if (headerEnd === -1) continue;

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

    // Risk hero — pull the risk section out for special treatment
    const riskSection = sections.find(s => s.key === 'risk');
    const sunSection = sections.find(s => s.key === 'sun');
    const contentSections = sections.filter(s => s.key !== 'risk' && s.key !== 'sun');

    const color = riskLevel ? riskColor(riskLevel) : '#64748b';
    const riskHeroHtml = riskLevel
        ? `<div class="risk-hero" style="background: ${color}10; border: 1px solid ${color}25;">
            <div class="risk-number" style="color: ${color};">${escapeHtml(String(riskLevel))}<span>/5</span></div>
            <div class="risk-detail">
                <div class="risk-label" style="color: ${color};">${riskLabel ? escapeHtml(riskLabel) : 'Unknown'}</div>
                ${riskSection ? `<div class="risk-desc">${escapeHtml(riskSection.content)}</div>` : ''}
            </div>
        </div>`
        : (riskSection
            ? `<div class="section" style="border-color: ${riskSection.color}; animation: fadeUp 0.4s ease-out 0.1s both;">
                <div class="section-label" style="color: ${riskSection.color};">${escapeHtml(riskSection.label)}</div>
                <div class="section-body">${escapeHtml(riskSection.content)}</div>
            </div>`
            : '');

    let sectionsHtml = '';
    let delay = 0.15;
    for (const section of contentSections) {
        delay += 0.04;
        sectionsHtml += `
        <div class="section" style="border-color: ${section.color}; animation: fadeUp 0.4s ease-out ${delay.toFixed(2)}s both;">
            <div class="section-label" style="color: ${section.color};">${escapeHtml(section.label)}</div>
            <div class="section-body">${escapeHtml(section.content)}</div>
        </div>`;
    }

    // Sunrise bar — compact inline
    const sunHtml = sunSection
        ? `<div class="sun-bar" style="animation: fadeUp 0.4s ease-out ${(delay + 0.04).toFixed(2)}s both;">
            <span>${escapeHtml(sunSection.content)}</span>
        </div>`
        : '';

    const body = `
    <div class="container">
        <nav>
            <a href="/">&larr; conditionsreport.com</a>
            <div class="nav-date">${escapeHtml(dateStr)}</div>
        </nav>
        <div class="report-header">
            <h1>${escapeHtml(massif.name)}</h1>
        </div>
        ${riskHeroHtml}
        ${sectionsHtml}
        ${sunHtml}
        <div class="cta" style="animation: fadeUp 0.4s ease-out ${(delay + 0.08).toFixed(2)}s both;">
            <p>Get <strong>${escapeHtml(massif.name)}</strong> conditions daily on WhatsApp</p>
            <a href="${waLink}" class="wa-btn" target="_blank" rel="noopener">
                ${whatsappSvg()}
                Send to me
            </a>
        </div>
        <footer>
            <a href="/">conditionsreport.com</a> &middot; <a href="https://theo.dev" target="_blank" rel="noopener">theo.dev</a>
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
                width: 32px; height: 32px;
                border: 2px solid rgba(255,255,255,0.08);
                border-top-color: #60a5fa;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto 20px;
            }
        </style>
        <div class="spinner"></div>
        <p style="color: #64748b; font-size: 14px;">${escapeHtml(massif.name)}</p>
    </div>`;

    return wrapHtml(title, description, body, {refreshSeconds: 3});
}

export function renderNotAvailablePage(massif: Massif): string {
    const title = `${massif.name} — No Report Available`;
    const description = `No avalanche bulletin currently available for ${massif.name}`;

    const waLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(massif.name)}`;

    const body = `
    <div class="container" style="padding-top: 80px;">
        <nav><a href="/">&larr; conditionsreport.com</a></nav>
        <div style="text-align: center; margin-top: 48px;">
            <h1 style="font-size: 24px; font-weight: 600; color: #f8fafc; margin-bottom: 12px;">${escapeHtml(massif.name)}</h1>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 28px; line-height: 1.6;">
                No avalanche bulletin is currently available.<br>
                Bulletins are published during the winter season.
            </p>
            <a href="${waLink}" class="wa-btn" target="_blank" rel="noopener">
                ${whatsappSvg()}
                Get notified on WhatsApp
            </a>
        </div>
        <footer>
            <a href="/">conditionsreport.com</a> &middot; <a href="https://theo.dev" target="_blank" rel="noopener">theo.dev</a>
        </footer>
    </div>`;

    return wrapHtml(title, description, body);
}
