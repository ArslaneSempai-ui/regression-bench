/**
 * The system under test: screening a name against a sanctions list.
 *
 * Successive versions, written the way they actually get written. Each fixes a visible
 * defect in the one before, and each introduces its own. This is not an example
 * manufactured for a demonstration: it is the ordinary arc of a screening project, and
 * the reason teams eventually stop being able to say whether they are making progress.
 *
 * The list is invented. No real sanctions-list name appears in it.
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
 * Literal comparison, give or take whitespace.
 *
 * Nobody defends this version, and yet it is always the first one written. It misses
 * everything not typed identically — which is to say, almost everything.
 */
export function screenExact(name: string): Match {
  const n = name.trim();
  return WATCHLIST.find((x) => x === n) ?? null;
}

/* ------------------------------------------------- v2: normalised */

function normalise(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // accents
    .toLowerCase()
    .replace(/['’\-.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words sorted: "Ali Mohamed" and "Mohamed Ali" become the same thing. */
const sortedWords = (s: string) => normalise(s).split(" ").filter(Boolean).sort().join(" ");

/**
 * Casse, accents, ponctuation et ordre des mots.
 *
 * A real gain with no visible cost — which is what makes it dangerous: it builds the
 * confidence the next version is about to spend.
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

/** Tolerance in characters, proportional to the length of the name. */
export const TOLERANCE = (longueur: number) => Math.max(1, Math.floor(longueur * 0.15));

/**
 * Edit distance, to catch typos and transliterations.
 *
 * It gains what v2 missed. It loses elsewhere, and that is the heart of the matter: on
 * short names, a tolerance of one character is enough to confuse two distinct people.
 * "Li Wei" and "Li Wen" are one letter apart.
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

/** Budget allowed for the fuzzy search, in milliseconds. */
export const BUDGET_MS = 0.04;

/**
 * The same thing, with a time guard.
 *
 * A very common production pattern: fuzzy search is expensive, so it gets a budget, and
 * past that the system falls back to exact comparison rather than hold the line. Nobody
 * treats this as a change of behaviour — it is presented
 * comme une optimisation.
 *
 * It is one, though: under load, the same name yields a match one day and
 * lendemain aucune. Le banc ne peut plus compare quoi que ce soit, parce qu'il mesure
 * the state of the machine as much as the code. That is precisely what the stability
 * measurement is for — flushing it out before a week is lost to false regressions.
 */
export function screenUnderBudget(name: string): Match {
  const cible = sortedWords(name);
  if (!cible) return null;

  const exact = WATCHLIST.find((x) => sortedWords(x) === cible);
  if (exact) return exact;

  const started = performance.now();
  let best: { name: string; d: number } | null = null;
  for (const x of WATCHLIST) {
    if (performance.now() - started > BUDGET_MS) return null; // budget spent: fall back
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

/*
 * Which versions are deterministic, declared rather than sampled.
 *
 * `v4-sous-budget` races a clock, so it is non-deterministic by construction — that is
 * its entire purpose in this demonstration. Detecting that by running it five times and
 * checking for disagreement is unreliable in the direction that matters: five rounds can
 * agree by luck and pronounce it stable.
 *
 * A README build that samples for flakiness is therefore itself flaky, which is how this
 * came to light — five cold runs of the check, four reporting the table stale with no
 * code change at all. What is known by construction gets declared; the stability sweep
 * stays for systems whose behaviour is not known in advance.
 */
export const DETERMINISTIC: Record<VersionName, boolean> = {
  "v1-exact": true,
  "v2-normalise": true,
  "v3-approximatif": true,
  "v4-sous-budget": false,
};
