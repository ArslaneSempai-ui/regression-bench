/**
 * Le système évalué : cribler un nom contre une liste de sanctions.
 *
 * Trois versions successives, telles qu'on les écrit vraiment. Chacune corrige un défaut
 * visible de la précédente, et chacune introduit le sien. Ce n'est pas un exemple
 * fabriqué pour la démonstration : c'est le déroulé ordinaire d'un projet de criblage,
 * et la raison pour laquelle les équipes finissent par ne plus savoir si elles avancent.
 *
 * La liste est fictive. Aucun nom réel de liste de sanctions n'y figure.
 */

export type Correspondance = string | null;

export const LISTE = [
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
 * Comparaison littérale, aux espaces près.
 *
 * Personne ne défend cette version, et pourtant c'est toujours la première écrite. Elle
 * rate tout ce qui n'a pas été saisi à l'identique — c'est-à-dire l'essentiel.
 */
export function criblerExact(nom: string): Correspondance {
  const n = nom.trim();
  return LISTE.find((x) => x === n) ?? null;
}

/* ------------------------------------------------- v2 : normalisé */

function normaliser(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // accents
    .toLowerCase()
    .replace(/['’\-.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les mots triés : « Ali Mohamed » et « Mohamed Ali » deviennent la même chose. */
const motsTries = (s: string) => normaliser(s).split(" ").filter(Boolean).sort().join(" ");

/**
 * Casse, accents, ponctuation et ordre des mots.
 *
 * Gain réel et sans contrepartie visible — c'est ce qui la rend dangereuse : elle
 * installe la confiance que la version suivante va dépenser.
 */
export function criblerNormalise(nom: string): Correspondance {
  const cible = motsTries(nom);
  if (!cible) return null;
  return LISTE.find((x) => motsTries(x) === cible) ?? null;
}

/* ----------------------------------------------------- v3 : approximatif */

function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let precedent = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const courant = [i];
    for (let j = 1; j <= n; j++) {
      courant[j] = Math.min(
        precedent[j] + 1,
        courant[j - 1] + 1,
        precedent[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    precedent = courant;
  }
  return precedent[n];
}

/** Tolérance en nombre de caractères, proportionnelle à la longueur du nom. */
export const TOLERANCE = (longueur: number) => Math.max(1, Math.floor(longueur * 0.15));

/**
 * Distance d'édition, pour rattraper les fautes de frappe et les translittérations.
 *
 * Elle gagne ce que la v2 ratait. Elle perd ailleurs, et c'est le cœur du sujet : sur
 * les noms courts, une tolérance d'un seul caractère suffit à confondre deux personnes
 * distinctes. « Li Wei » et « Li Wen » sont à une lettre l'un de l'autre.
 *
 * Le taux global monte. Des cas qui passaient ne passent plus. C'est exactement ce que
 * le banc existe pour rendre visible.
 */
export function criblerApproximatif(nom: string): Correspondance {
  const cible = motsTries(nom);
  if (!cible) return null;

  const exact = LISTE.find((x) => motsTries(x) === cible);
  if (exact) return exact;

  let meilleur: { nom: string; d: number } | null = null;
  for (const x of LISTE) {
    const d = distance(cible, motsTries(x));
    if (d <= TOLERANCE(Math.max(cible.length, motsTries(x).length)) &&
        (meilleur === null || d < meilleur.d)) {
      meilleur = { nom: x, d };
    }
  }
  return meilleur?.nom ?? null;
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
 * C'en est un pourtant : sous charge, le même nom donne un jour une correspondance et le
 * lendemain aucune. Le banc ne peut plus comparer quoi que ce soit, parce qu'il mesure
 * l'état de la machine autant que le code. C'est précisément ce que la mesure de
 * stabilité sert à débusquer avant de perdre une semaine sur de fausses régressions.
 */
export function criblerSousBudget(nom: string): Correspondance {
  const cible = motsTries(nom);
  if (!cible) return null;

  const exact = LISTE.find((x) => motsTries(x) === cible);
  if (exact) return exact;

  const debut = performance.now();
  let meilleur: { nom: string; d: number } | null = null;
  for (const x of LISTE) {
    if (performance.now() - debut > BUDGET_MS) return null; // budget épuisé : repli
    const d = distance(cible, motsTries(x));
    if (d <= TOLERANCE(Math.max(cible.length, motsTries(x).length)) &&
        (meilleur === null || d < meilleur.d)) {
      meilleur = { nom: x, d };
    }
  }
  return meilleur?.nom ?? null;
}

export const VERSIONS = {
  "v1-exact": criblerExact,
  "v2-normalise": criblerNormalise,
  "v3-approximatif": criblerApproximatif,
  "v4-sous-budget": criblerSousBudget,
} as const;

export type NomDeVersion = keyof typeof VERSIONS;
