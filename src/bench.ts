/**
 * Le banc.
 *
 * Un système à évaluer est une simple fonction. Le banc ne sait rien de ce qu'il y a
 * dedans — un modèle, des règles, un appel réseau — et c'est voulu : dès qu'un banc
 * connaît son sujet, il ne sert qu'à lui.
 *
 * Ce qu'il enregistre n'est pas une note mais une **exécution** : le résultat de chaque
 * cases, un par un. Une note ne se compare pas ; une exécution, si. C'est toute la
 * différence entre « on est à 80 % » et « ces sept cas-là ne marchent plus ».
 */

import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const DIRECTORY = new URL("../data/runs", import.meta.url).pathname;

/** Un texte dans les deux langues : le moteur ne produit jamais d'affichage. */
export type Bilingual = { fr: string; en: string };

export type Case<E, S> = {
  id: string;
  /** À quoi sert ce cases. Un cas dont personne ne sait why il existe finit supprimé. */
  why: Bilingual;
  input: E;
  expected: S;
};

export type Result = {
  caseId: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  /** Millisecondes. Une régression de vitesse est une régression. */
  duration: number;
  error: string | null;
};

export type Run = {
  /** Le name de la version évaluée — pas un horodatage : on compare des versions. */
  version: string;
  le: string;
  results: Result[];
  passed: number;
  total: number;
  rate: number;
  totalDuration: number;
};

/** Comment on judge qu'une output est correcte. Par défaut, l'égalité stricte. */
export type Judge<S> = (actual: S, expected: S) => boolean;

const equality = <S,>(a: S, b: S) => JSON.stringify(a) === JSON.stringify(b);

export async function run<E, S>(
  version: string,
  system: (input: E) => S | Promise<S>,
  cases: Case<E, S>[],
  judge: Judge<S> = equality,
): Promise<Run> {
  const results: Result[] = [];

  for (const c of cases) {
    const debut = performance.now();
    try {
      const actual = await system(c.input);
      results.push({
        caseId: c.id, passed: judge(actual, c.expected), actual, expected: c.expected,
        duration: performance.now() - debut, error: null,
      });
    } catch (e) {
      // Une exception est un échec du cases, pas du banc. Un banc qui s'arrête au premier
      // plantage ne dit rien des cas suivants — et c'est souvent là qu'est l'information.
      results.push({
        caseId: c.id, passed: false, actual: null, expected: c.expected,
        duration: performance.now() - debut,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    version, le: new Date().toISOString(), results,
    passed, total: results.length,
    rate: results.length === 0 ? 0 : passed / results.length,
    totalDuration: results.reduce((s, r) => s + r.duration, 0),
  };
}

const pathFor = (version: string) =>
  `${DIRECTORY}/${version.replace(/[^a-z0-9_.-]/gi, "_")}.json`;

export function save(execution: Run): string {
  mkdirSync(DIRECTORY, { recursive: true });
  const ou = pathFor(execution.version);
  writeFileSync(ou, JSON.stringify(execution, null, 2));
  return ou;
}

export function load(version: string): Run | null {
  const ou = pathFor(version);
  return existsSync(ou) ? JSON.parse(readFileSync(ou, "utf8")) : null;
}

export function runs(): Run[] {
  if (!existsSync(DIRECTORY)) return [];
  return readdirSync(DIRECTORY)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${DIRECTORY}/${f}`, "utf8")) as Run)
    .sort((a, b) => a.le.localeCompare(b.le));
}
