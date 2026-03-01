/**
 * Exercises MassifCache.searchByName against a representative set of massif names.
 * Run: cd scripts && npx tsx test-search.ts
 */

// ── Inline the normalize + searchByName logic so we can test without DB ──

type Massif = { name: string; code: number };

function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function searchByName(allMassifs: Massif[], query: string): Massif[] {
    const normalized = normalize(query);
    if (normalized.length < 2) return [];

    const exact = allMassifs.find(m => normalize(m.name) === normalized);
    if (exact) return [exact];

    return allMassifs.filter(m => {
        const name = normalize(m.name);
        return name.includes(normalized) || normalized.includes(name);
    });
}

// ── Representative massif names (real data) ──

const MASSIFS: Massif[] = [
    {name: 'Aravis', code: 1},
    {name: 'Bauges', code: 2},
    {name: 'Beaufortain', code: 3},
    {name: 'Belledonne', code: 4},
    {name: 'Champsaur', code: 5},
    {name: 'Chartreuse', code: 6},
    {name: 'Chablais', code: 7},
    {name: 'Dévoluy', code: 8},
    {name: 'Grandes-Rousses', code: 9},
    {name: 'Haute-Maurienne', code: 10},
    {name: 'Haute-Tarentaise', code: 11},
    {name: 'Maurienne', code: 12},
    {name: 'Mont-Blanc', code: 13},
    {name: 'Oisans', code: 14},
    {name: 'Pelvoux', code: 15},
    {name: 'Queyras', code: 16},
    {name: 'Taillefer', code: 17},
    {name: 'Vanoise', code: 18},
    {name: 'Vercors', code: 19},
    {name: 'Haute-Ariège', code: 20},
    {name: 'Orlu-St-Barthélemy', code: 21},
    {name: 'Couserans', code: 22},
    {name: 'Luchonnais', code: 23},
    {name: 'Aure-Louron', code: 24},
    {name: 'Haute-Bigorre', code: 25},
    {name: 'Aspe-Ossau', code: 26},
    {name: 'Pays-Basque', code: 27},
    {name: 'Andorre', code: 28},
    {name: 'Capcir-Puymorens', code: 29},
    {name: 'Cerdagne-Canigou', code: 30},
    {name: 'Haut-Var Haut-Verdon', code: 31},
    {name: 'Mercantour', code: 32},
    {name: 'Ubaye', code: 33},
    {name: 'Thabor', code: 34},
    {name: 'Embrunais-Parpaillon', code: 35},
];

// ── Test cases ──

type TestCase = {
    query: string;
    expectedNames: string[];   // exact set of expected matches (empty = no match)
};

const tests: TestCase[] = [
    // Exact matches
    {query: 'Vanoise', expectedNames: ['Vanoise']},
    {query: 'vanoise', expectedNames: ['Vanoise']},
    {query: 'VANOISE', expectedNames: ['Vanoise']},
    {query: 'Mont-Blanc', expectedNames: ['Mont-Blanc']},
    {query: 'mont blanc', expectedNames: ['Mont-Blanc']},
    {query: 'mont-blanc', expectedNames: ['Mont-Blanc']},
    {query: 'Beaufortain', expectedNames: ['Beaufortain']},

    // Accented queries
    {query: 'Devoluy', expectedNames: ['Dévoluy']},
    {query: 'Dévoluy', expectedNames: ['Dévoluy']},
    {query: 'haute ariege', expectedNames: ['Haute-Ariège']},
    {query: 'Haute-Ariège', expectedNames: ['Haute-Ariège']},

    // Short substring matches
    {query: 'beau', expectedNames: ['Beaufortain']},       // user's reported case
    {query: 'vano', expectedNames: ['Vanoise']},
    {query: 'mont', expectedNames: ['Mont-Blanc']},         // only Mont-Blanc?
    {query: 'haute', expectedNames: ['Haute-Maurienne', 'Haute-Tarentaise', 'Haute-Ariège', 'Haute-Bigorre']},
    {query: 'oisans', expectedNames: ['Oisans']},

    // Bidirectional: query contains massif name
    {query: 'vanoise ski trip', expectedNames: ['Vanoise']},
    {query: 'near mont blanc', expectedNames: ['Mont-Blanc']},
    {query: 'beaufortain area', expectedNames: ['Beaufortain']},

    // Bidirectional: massif name contains query — potential false positives
    {query: 'maurienne', expectedNames: ['Haute-Maurienne', 'Maurienne']},
    {query: 'bar', expectedNames: ['Orlu-St-Barthélemy']},  // is this desired?
    {query: 'pays', expectedNames: ['Pays-Basque']},

    // No matches expected
    {query: 'a', expectedNames: []},                        // too short
    {query: 'chamonix', expectedNames: []},                 // place name, not massif
    {query: 'paris', expectedNames: []},
    {query: 'zermatt', expectedNames: []},

    // Ambiguous / potentially surprising
    {query: 'aure', expectedNames: ['Aure-Louron']},
    {query: 'cap', expectedNames: ['Capcir-Puymorens']},
    {query: 'ver', expectedNames: ['Vercors', 'Haut-Var Haut-Verdon']},
];

// ── Runner ──

let passed = 0;
let failed = 0;

for (const t of tests) {
    const results = searchByName(MASSIFS, t.query);
    const gotNames = results.map(m => m.name).sort();
    const expectedSorted = [...t.expectedNames].sort();
    const ok = JSON.stringify(gotNames) === JSON.stringify(expectedSorted);

    if (ok) {
        passed++;
        console.log(`  ✅  "${t.query}" → [${gotNames.join(', ')}]`);
    } else {
        failed++;
        console.log(`  ❌  "${t.query}"`);
        console.log(`      expected: [${expectedSorted.join(', ')}]`);
        console.log(`      got:      [${gotNames.join(', ')}]`);
    }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
process.exit(failed > 0 ? 1 : 0);
