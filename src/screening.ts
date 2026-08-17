/**
 * Le système évalué : cribler un name contre une liste de sanctions.
 *
 * Trois versions successives, telles qu'on les écrit vraiment. Chacune corrige un défaut
 * visible de la précédente, et chacune introduit le sien. Ce n'est pas un exemple
 * fabriqué pour la démonstration : c'est le déroulé ordinaire d'un projet de criblage,
 * et la raison pour laquelle les équipes finissent par ne plus savoir si elles avancent.
 *
 * La liste est fictive. Aucun name réel de liste de sanctions n'y figure.
 */

export type Match = string | null;

export const WATCHLIST = [
  "Viktor Alexeyevich Morozov",
  "Amina Haddad",
  "Li Wei",
  "Jean-Baptiste N'Diaye",
  "Sociedad Comercial del Norte",
  "Ahmad Reza Khorasani",
  "Olga Petrova",
  "Grupo Financiero Vega",
];

/* ------------------------------------------------------------------ v1 : exact */

/**
 * Comparison littérale, aux espaces près.
 *
 * Personne ne défend cette version, et pourtant c'est toujours la première écrite. Elle
 * rate tout ce qui n'a pas été saisi à l'identique — c'est-à-dire l'essentiel.
 */
export function screenExact(name: string): Match {
  const n = name.trim();
  return WATCHLIST.find((x) => x === n) ?? null;
}

/* ------------------------------------------------- v2 : normalisé */

function normalise(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // accents
    .toLowerCase()
    .replace(/['’\-.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les mots triés : « Ali Mohamed » et « Mohamed Ali » deviennent la même chose. */
const sortedWords = (s: string) => normalise(s).split(" ").filter(Boolean).sort().join(" ");

/**
 * Casse, accents, ponctuation et ordre des mots.
 *
 * Gain réel et sans contrepartie visible — c'est ce qui la rend dangereuse : elle
 * installe la confiance que la version suivante va dépenser.
 */
export function screenNormalised(name: string): Match {
  const cible = sortedWords(name);
  if (!cible) return null;
  return WATCHLIST.find((x) => sortedWords(x) === cible) ?? null;
}

/* ----------------------------------------------------- v3 : approximatif */

function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let previous = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const current = [i];
    for (let j = 1; j <= n; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[n];
}

/** Tolérance en nombre de caractères, proportionnelle à la longueur du name. */
export const TOLERANCE = (longueur: number) => Math.max(1, Math.floor(longueur * 0.15));

/**
 * Distance d'édition, pour rattraper les fautes de frappe et les translittérations.
 *
 * Elle gagne ce que la v2 ratait. Elle perd ailleurs, et c'est le cœur du sujet : sur
 * les noms courts, une tolérance d'un seul caractère suffit à confondre deux personnes
 * distinctes. « Li Wei » et « Li Wen » sont à une lettre l'un de l'autre.
 *
 * Le rate global monte. Des cas qui passaient ne passent plus. C'est exactement ce que
 * le banc existe pour rendre visible.
 */
export function screenFuzzy(name: string): Match {
  const cible = sortedWords(name);
  if (!cible) return null;

  const exact = WATCHLIST.find((x) => sortedWords(x) === cible);
  if (exact) return exact;

  let best: { name: string; d: number } | null = null;
  for (const x of WATCHLIST) {
    const d = distance(cible, sortedWords(x));
    if (d <= TOLERANCE(Math.max(cible.length, sortedWords(x).length)) &&
        (best === null || d < best.d)) {
      best = { name: x, d };
    }
  }
  return best?.name ?? null;
}

/* -------------------------------------------- v4 : approximatif sous budget */

/** Budget alloué à la recherche approximative, en millisecondes. */
export const BUDGET_MS = 0.04;

/**
 * La même chose, avec un garde-fou de temps.
 *
 * Motif très répandu en production : la recherche approximative coûte cher, on lui
 * alloue un budget, et au-delà on se rabat sur une comparaison exacte pour ne pas tenir
 * la ligne. Personne ne considère ça comme un changement de comportement — c'est présenté
 * comme une optimisation.
 *
 * C'en est un pourtant : sous payload, le même name donne un jour une correspondance et le
 * lendemain aucune. Le banc ne peut plus compare quoi que ce soit, parce qu'il mesure
 * l'état de la machine autant que le code. C'est précisément ce que la mesure de
 * stabilité sert à débusquer before de perdre une semaine sur de fausses régressions.
 */
export function screenUnderBudget(name: string): Match {
  const cible = sortedWords(name);
  if (!cible) return null;

  const exact = WATCHLIST.find((x) => sortedWords(x) === cible);
  if (exact) return exact;

  const debut = performance.now();
  let best: { name: string; d: number } | null = null;
  for (const x of WATCHLIST) {
    if (performance.now() - debut > BUDGET_MS) return null; // budget épuisé : repli
    const d = distance(cible, sortedWords(x));
    if (d <= TOLERANCE(Math.max(cible.length, sortedWords(x).length)) &&
        (best === null || d < best.d)) {
      best = { name: x, d };
    }
  }
  return best?.name ?? null;
}

export const VERSIONS = {
  "v1-exact": screenExact,
  "v2-normalise": screenNormalised,
  "v3-approximatif": screenFuzzy,
  "v4-sous-budget": screenUnderBudget,
} as const;

export type VersionName = keyof typeof VERSIONS;
