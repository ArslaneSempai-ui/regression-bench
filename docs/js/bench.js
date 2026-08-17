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
const equality = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export async function run(version, system, cases, judge = equality) {
    const results = [];
    for (const c of cases) {
        const debut = performance.now();
        try {
            const actual = await system(c.input);
            results.push({
                caseId: c.id, passed: judge(actual, c.expected), actual, expected: c.expected,
                duration: performance.now() - debut, error: null,
            });
        }
        catch (e) {
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
function memoryStore() {
    const kept = new Map();
    return {
        read: (version) => kept.get(version) ?? null,
        write: (execution) => { kept.set(execution.version, execution); },
        all: () => [...kept.values()].sort((a, b) => a.le.localeCompare(b.le)),
    };
}
let store = memoryStore();
export function brancherStore(s) {
    store = s;
}
export function save(execution) {
    store.write(execution);
    return execution.version;
}
export function load(version) {
    return store.read(version);
}
export function runs() {
    return store.all();
}
