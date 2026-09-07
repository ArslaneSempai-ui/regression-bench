# What was checked here, and what it cost

Six checks, run against this repository. **Two found something. Four resisted, and saying
which four is the point**: a report that lists only what it found does not let anyone tell
a clean repository from an unexamined one.

---

## Found

### 1. Fourteen file URLs read through `.pathname`

`new URL(f, import.meta.url).pathname` keeps the percent-encoding. On any checkout whose
directory name contains a space or an accent, `readFileSync` receives `%20` and fails,
silently, wherever a `catch` stands in the way.

Fourteen uses, in ten files. All fixed with `fileURLToPath`.

### 2. The guard against it did not travel with the modules it protects

The sibling repository swept ninety-one of these today **and wrote a test that forbids
them**. That test exists in one repository. Measured across the family:

    cascade      guard present, repository clean
    banc         guard ABSENT, 14 occurrences
    economics    guard ABSENT, 12 occurrences
    remediation  guard ABSENT

`figures.ts`, `interval.ts`, `provenance.ts` and `cli.ts` are kept byte-identical across
repositories, checked md5 for md5. **The tests that defend them are not.** A shared module
without its shared guard is half a mechanism, and twenty-six occurrences are what that half
costs.

The guard now lives here as `src/chemins.test.ts`: **its own file, not appended to a shared
one**, precisely so it can be copied whole into the repositories that lack it.

**Four files are deliberately not fixed, and the exemption is declared in the test rather
than hidden.** `demo.test.ts`, `ecran.test.ts`, `liaison.test.ts` and `registre.test.ts` are
shared verbatim with `identite`, their canonical source, which is outside this repository.
Correcting them here would make `les couches partagées` fail by construction: the repository
would be correct and inconsistent at the same time. The count of exempted occurrences is
asserted to be non-zero, so the exclusion cannot quietly become an exemption that exempts
nothing.

Proved in both directions: reintroducing the pattern in `store.ts` fails the test and names
`store.ts:14`; restoring it passes.

---

## Resisted

**Every marker block is generated and checked.** Five markers in `README.md` (`finding`,
`versions`, `verdict`, `stakes`, `provenance`) and `src/readme.ts` emits exactly those five
keys. `--check` is already wired into `npm test`. Proved both ways: clean exits 0, a single
falsified rate in the `finding` block exits 1 and names the block, regeneration returns to
clean.

**Fence parity.** `README.md` carries 8 fences, even. No orphan.

**Selections declare what they drop.** The one `continue` in the codebase (`diff.ts:64`,
skipping cases absent from the second run) does not lose them: they come back as `removed`,
counted, beside `added`. The discard is declared.

**No dead guard found.** No constant predicate, no `catch` returning a fixed value, no
always-true condition in the published paths.

**Comment figures are correct today.** The load-bearing one ("22 cases", asserted in four
files) matches `CASES.length`. `inventory.ts` says "81.8 % against 86.4 % on 22 cases" and
the generated block says "81.8 % to 86.4 %… On 22 cases". They agree. **They are hand-typed
and will rust the day the runs change**, which is a latent defect and worth saying, but it
is not one today.

**Hostile input does not apply here.** This repository parses no user-supplied file. The one
place an outside string reaches the filesystem (`/api/compare?before=…` into
`store.ts:pathFor`) is sanitised: every character outside `[a-z0-9_.-]` becomes `_`, so no
separator survives and traversal is impossible. One note without a finding: `all()` calls
`JSON.parse` unguarded on every file in `data/runs`, so a corrupted run file takes down the
listing rather than being skipped with a name. The data is self-produced, which is why this
is a note and not a defect.

---

## Left alone, on purpose

`src/registre.css` and `docs/registre.css` are modified in the working tree and are **not
mine**. They were rewritten at 21:10:52 by another session propagating a contrast fix; the
same content landed in `economics`, `remediation` and `identite` in the same second. **A file
someone is editing belongs to someone who is working.** They are not committed here.

---

## Verification

    npm test    39 tests, 39 pass, 0 fail
    figures.ts, interval.ts, provenance.ts, cli.ts: md5 identical to cascade,
    before and after this work.
