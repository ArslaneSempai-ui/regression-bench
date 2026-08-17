import { test } from "node:test";
import { INVENTORY, MUST_DECLARE } from "./inventory.ts";
import { REGULATIONS } from "./regulations.ts";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { run } from "./bench.ts";
import { compare, summarise, DURATION_NOISE_MS } from "./diff.ts";
import { measureStability } from "./stability.ts";
import { screenExact, screenNormalised, screenFuzzy, VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";
import type { Case } from "./bench.ts";

const smallSet: Case<number, number>[] = [
  { id: "a", why: { fr: "double", en: "double" }, input: 2, expected: 4 },
  { id: "b", why: { fr: "double", en: "double" }, input: 3, expected: 6 },
  { id: "c", why: { fr: "double", en: "double" }, input: 4, expected: 8 },
];

test("an exception in the system fails the case, not the bench", async () => {
  const e = await run("crashes", (n: number) => {
    if (n === 3) throw new Error("boom");
    return n * 2;
  }, smallSet);

  assert.equal(e.total, 3, "the cases after it still run");
  assert.equal(e.passed, 2);
  assert.equal(e.results.find((r) => r.caseId === "b")?.error, "boom");
});

test("a regression is reported even when the rate goes up", async () => {
  // Three passing cases, then a version that gains one and breaks another.
  const before = await run("before", (n: number) => (n === 4 ? 0 : n * 2), smallSet);
  const after = await run("after", (n: number) => (n === 2 ? 0 : n * 2), smallSet);

  const c = compare(before, after);
  assert.equal(c.rateBefore, c.rateAfter, "the rate is identical");
  assert.equal(c.verdict, "regression", "and yet a validated case is broken");
  assert.equal(c.regressions.length, 1);
  assert.equal(c.gains.length, 1);
});

test("the verdict stays a regression even when gains outnumber losses", async () => {
  const before = await run("a", (n: number) => (n === 2 ? n * 2 : 0), smallSet);
  const after = await run("b", (n: number) => (n === 2 ? 0 : n * 2), smallSet);

  const c = compare(before, after);
  assert.ok(c.rateAfter > c.rateBefore, "the average improves");
  assert.equal(c.verdict, "regression", "one broken case is enough to make the change suspect");
  assert.match(summarise(c), /regression/);
});

test("two sets with no case in common cannot be compared", async () => {
  const before = await run("a", (n: number) => n * 2, smallSet);
  const after = await run("b", (n: number) => n * 2,
    [{ id: "z", why: { fr: "autre", en: "another" }, input: 1, expected: 2 }]);

  const c = compare(before, after);
  assert.equal(c.verdict, "incomparable");
  assert.equal(c.added.length, 1);
  assert.equal(c.removed.length, 3);
});

test("a change of output with no change of verdict is reported", async () => {
  const set: Case<number, unknown>[] = [{ id: "x", why: { fr: "échoue des deux côtés", en: "fails on both sides" }, input: 1, expected: "expected" }];
  const before = await run("a", () => "wrong-1", set);
  const after = await run("b", () => "wrong-2", set);

  const c = compare(before, after);
  assert.equal(c.silent.length, 1, "same failure, different cause — worth seeing");
});

test("duration noise is not reported as a signal", async () => {
  const before = await run("a", (n: number) => n * 2, smallSet);
  const after = await run("b", (n: number) => n * 2, smallSet);
  const c = compare(before, after);
  // A few microseconds of difference can be hundreds of percent.
  assert.ok(!summarise(c).includes("slower") || Math.abs(c.durationAfter - c.durationBefore) >= DURATION_NOISE_MS);
});

test("flakiness is detected, and only when it is there", async () => {
  const stable = await measureStability("stable", (n: number) => n * 2, smallSet, 5);
  assert.equal(stable.stable, true);

  let round = 0;
  const flips = await measureStability("flips",
    (n: number) => (n === 3 && round++ % 2 === 0 ? 0 : n * 2), smallSet, 6);
  assert.equal(flips.stable, false);
  assert.equal(flips.unstable[0].caseId, "b");
  assert.equal(flips.unstable[0].outputs.length, 2, "two distinct outputs observed");
});

/* --- the system under test, on its own terms --- */

test("each version does what it claims", () => {
  assert.equal(screenExact("AMINA HADDAD"), null, "the exact version does not forgive case");
  assert.equal(screenNormalised("AMINA HADDAD"), "Amina Haddad");
  assert.equal(screenNormalised("Haddad Amina"), "Amina Haddad", "word order is absorbed");
  assert.equal(screenNormalised("Amina Haddadd"), null, "the typo still gets through");
  assert.equal(screenFuzzy("Amina Haddadd"), "Amina Haddad");
});

test("the fuzzy version confuses two distinct short names", () => {
  // The defect the whole case set exists to catch.
  assert.equal(screenNormalised("Li Wen"), null, "v2 had it right");
  assert.equal(screenFuzzy("Li Wen"), "Li Wei", "v3 gets it wrong, and the bench must say so");
});

test("no version matches an empty string", () => {
  for (const [name, system] of Object.entries(VERSIONS)) {
    assert.equal(system(""), null, `${name} matched an empty string`);
    assert.equal(system("   "), null, `${name} matched whitespace`);
  }
});

test("every case explains why it exists, in both languages", () => {
  for (const c of CASES) {
    for (const language of ["fr", "en"] as const) {
      assert.ok(c.why[language].length > 15,
        `case ${c.id} does not explain why it exists, in ${language}`);
    }
  }
  const ids = CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate case ids");
});

test("the set holds enough negative cases not to reward a system that says yes to everything", () => {
  const negatives = CASES.filter((c) => c.expected === null).length;
  assert.ok(negatives / CASES.length >= 0.3, `only ${negatives} negative cases out of ${CASES.length}`);
});

test("no French survives in the English half of the case set", () => {
  /*
   * This detector must contain French words, and must match whole words only.
   *
   * A mechanical rename replaced "nom" with "name" inside this very regex, turning the
   * guard into a false-alarm generator: it flagged the English word "name" in English
   * text. The repair then dropped the word boundaries, which would have flagged "cases"
   * for containing "cas". Both were caught by this test failing — which is the whole
   * argument for having it.
   */
  const french = /\b(cas|nom|pas|une|des|qui|sur|dans|correspondance|saisie|réponse|dossier)\b/i;
  for (const c of CASES) {
    assert.ok(!french.test(c.why.en), `${c.id}: "${c.why.en}"`);
  }
  // The guard guards itself: a detector matching nothing would pass in silence.
  assert.ok(french.test("le nom du dossier"), "the detector no longer detects French");
});

test("the stakes citation is real and reproduced exactly", () => {
  /*
   * The bench's README argues that a regression is a compliance event, and it rests that
   * claim on one retrieved section. A citation that drifts out of the shared file — or a
   * figure edited on the page and nowhere else — would leave the argument standing on
   * nothing, which is the failure this repository exists to complain about.
   */
  const r = REGULATIONS.blockedPropertyReport;
  assert.equal(r.cite, "31 CFR 501.603(b)(1)");
  assert.equal(r.figure, "10 business days");
  assert.ok(r.source.includes("501.603"), "the link must point at the section it cites");
  assert.ok(r.says.includes("ten business days"), "the summary must carry the figure it summarises");

  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes(r.cite), "the README must cite the section the test guards");
  assert.ok(readme.includes(r.source), "the README must link to the source, not just name it");
});

test("nothing the bench runs on is missing from the inventory", () => {
  /*
   * A page that classifies its own figures, typed by hand, goes stale the first time
   * somebody adds one — and in the flattering direction, because the figure you forget to
   * declare is the one you were least comfortable declaring.
   */
  const declared = new Set(INVENTORY.map((f) => f.name));
  for (const cite of MUST_DECLARE.regulations) {
    assert.ok(declared.has(cite), `${cite} is cited on the page and the inventory omits it`);
  }
  assert.ok(declared.has("CASES") && declared.has("WATCHLIST"),
    "the case set and the watchlist are invented and must say so");

  for (const f of INVENTORY.filter((x) => x.provenance === "chosen")) {
    assert.ok(f.note && f.note.length > 20, `${f.name} is chosen and says nothing about why`);
  }
});

test("the regression count is declared measured, and the rate is never declared without its interval", () => {
  /*
   * The asymmetry this bench exists to defend. A named case that stopped working is a fact
   * about the runs; a pass rate on 22 cases is an estimate with ±14 points around it. If
   * the inventory ever labelled them the same way, the page would be claiming the second
   * is as solid as the first.
   */
  const regressions = INVENTORY.find((f) => f.name === "regressions")!;
  const rate = INVENTORY.find((f) => f.name === "passRate")!;
  assert.equal(regressions.provenance, "measured");
  assert.equal(rate.provenance, "measured");
  assert.ok(/95 %/.test(rate.note ?? ""), "the rate must carry its interval in the inventory too");
  // Matching on the *absence* of the word "interval" failed on a note whose whole point
  // was to say an interval is not needed. Assert what is meant, not what is spelled.
  assert.ok(/fact about the runs/.test(regressions.note ?? ""),
    "a named regression is a fact about the runs, and the inventory has to say so");
});
