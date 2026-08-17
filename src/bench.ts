/**
 * Le banc.
 *
 * A system under test is just a function. The bench knows nothing about what is inside —
 * a model, some rules, a network call — and that is deliberate: the moment a bench knows
 * its subject, it only works for that subject.
 *
 * What it records is not a score but a **run**: the outcome of every case, one by one. A
 * score cannot be compared; a run can. That is the whole difference between "we're at
 * 80 %" and "these seven cases stopped working".
 */



/** Un texte dans les deux langues : le moteur ne produit jamais d'affichage. */
export type Bilingual = { fr: string; en: string };

export type Case<E, S> = {
  id: string;
  /** What this case is for. A case nobody knows the reason for ends up deleted. */
  why: Bilingual;
  input: E;
  expected: S;
};

export type Result = {
  caseId: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  /** Milliseconds. A speed regression is a regression. */
  duration: number;
  error: string | null;
};

export type Run = {
  /** The name of the version under test — not a timestamp: versions are what get compared. */
  version: string;
  le: string;
  results: Result[];
  passed: number;
  total: number;
  rate: number;
  totalDuration: number;
};

/** How an output is judged correct. Strict equality by default. */
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
      // An exception is a failure of the case, not of the bench. A bench that stops at the
      // first crash says nothing about the cases after it — and that is often where the
      // information is.
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

/**
 * Where runs are kept, decided by whoever runs the bench.
 *
 * This module used to import `node:fs` and write one file per run. Everything else in it
 * is pure — a system under test is a function, cases are data — so those four calls were
 * the only thing stopping the bench loading anywhere but Node, which is what blocked the
 * browser build of the hosted demo.
 *
 * Injecting the store costs a dozen lines and is better design regardless: a bench has no
 * business knowing what a filesystem is. The default keeps runs in memory, which is exactly
 * right for a demo where each visitor runs the versions themselves and nothing survives
 * the tab.
 */
export type Store = {
  read(version: string): Run | null;
  write(execution: Run): void;
  all(): Run[];
};

function memoryStore(): Store {
  const kept = new Map<string, Run>();
  return {
    read: (version) => kept.get(version) ?? null,
    write: (execution) => { kept.set(execution.version, execution); },
    all: () => [...kept.values()].sort((a, b) => a.le.localeCompare(b.le)),
  };
}

let store: Store = memoryStore();

export function brancherStore(s: Store): void {
  store = s;
}

export function save(execution: Run): string {
  store.write(execution);
  return execution.version;
}

export function load(version: string): Run | null {
  return store.read(version);
}

export function runs(): Run[] {
  return store.all();
}
