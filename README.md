# A bench that tells you what changed, not what you scored

Most evaluation harnesses hand you a number. A number can't tell you that your pass rate
went up **while three cases that used to work stopped working**.

This one refuses to call that an improvement.

```
npm start          # the comparison screen, on localhost:4600
npm run run-all    # run every version
npm run compare -- v2-normalise v3-approximatif
npm run stability  # the same system, several times over
npm test
```

---

## The demonstration

The system under test is a **sanctions name screening** — match a customer's name against
a watchlist. Four successive versions, each one a change any engineer would defend:

| Version | What changed | Pass rate |
|---|---|---|
| `v1-exact` | literal string comparison | 59.1 % |
| `v2-normalise` | case, accents, punctuation, word order | 81.8 % |
| `v3-approximatif` | edit distance, for typos and transliterations | **86.4 %** |
| `v4-sous-budget` | v3 with a time budget, falling back to exact | 81.8 % |

Read the rate column and v3 is the winner. Now ask the bench what actually happened
between v2 and v3:

![Comparing two versions](images/comparison.png)

```
✗ 2 regression(s) — v2-normalise -> v3-approximatif
    court-01: expected null, got "Li Wei"
    court-02: expected null, got "Li Wei"
  (3 gain(s) elsewhere — the rate moves 81.8 % -> 86.4 %,
   which does not buy back cases that had been validated once.)
  the set cannot distinguish these versions by rate — judge the broken
  cases instead (5 discordant, p = 1.000)
```

That last line is the bench proving its own argument. **The rate difference is not
established by this case set** — 81.8 % carries a 95 % interval of [61–93] and 86.4 %
one of [67–95], and on the five cases that actually changed verdict the split is
indistinguishable from a coin. Anyone reading 86.4 % as "better" is reading noise.

The two broken cases are not noise. They are two named inputs where a system that once
told two people apart no longer does. That asymmetry — a rate you cannot trust beside
facts you can — is the entire reason this tool reports movements rather than scores.

Fuzzy matching bought three typo cases and paid with **two distinct people now
indistinguishable**. On a short name, one character of tolerance is one character too
many: *Li Wen* is not *Li Wei*. The average went up. The system got worse at the thing it
exists to do.

That's not a contrived example. It's the ordinary arc of every screening project, and the
reason teams eventually stop being able to say whether they're making progress.

---

## What it does

**Records runs, not scores.** A run holds the outcome of every case, one by one. A score
can't be compared; a run can. That's the whole difference between "we're at 80 %" and
"these seven cases stopped working".

**Refuses to grade on the average.** Any regression makes the change suspect, whatever the
rate did. A human can override that — but knowingly. `npm run compare` exits non-zero on
a regression, so continuous integration can block on it. A report nobody opens is not a
control.

**Detects flakiness before it poisons everything.** `v4-sous-budget` is the version nobody
thinks of as a behaviour change: fuzzy search is expensive, so it gets a time budget and
falls back to exact matching when the budget runs out. It ships as an *optimisation*.

Running the same cases eight times:

```
v4-sous-budget     4 unstable case(s)
    faute-01 : 7/8 — outputs seen: null, "Amina Haddad"
    faute-02 : 7/8 — outputs seen: null, "Olga Petrova"
    court-02 : 1/8 — outputs seen: "Li Wei", null
```

Under load, the same customer is screened differently. Every later comparison would report
regressions and gains that have nothing to do with the code, and the team would learn to
ignore the bench. **Stability is the measurement to take first**, before comparing
anything — and almost nobody takes it.

**Flags silent output changes.** Same verdict, different output. Usually harmless,
occasionally the sign that a case is passing for the wrong reason and won't pass for much
longer.

**Notices when the case set moved.** Comparing runs over different sets is a partial
comparison, and the screen says so instead of quietly averaging over whatever overlaps.

---

## The case set is the real asset

Twenty-two cases, and **every one of them carries a written reason for existing**, in both
languages. It's the most useful rule in the project: a case nobody can justify gets
deleted the day it becomes inconvenient — usually by the person who just introduced the
bug it was catching.

Seven of the twenty-two are **negative** cases, names that must *not* match. A set made
only of expected hits rewards a system that says yes to everything, and that system will
score beautifully.

One case, `accent-01`, fails in all four versions. It's left in deliberately: a bench that
only contains problems already solved tells you nothing about the ones ahead.

---

## How it's built

```
src/
  bench.ts       the harness: cases, runs, persistence
  diff.ts        run comparison, the verdict, the regression rule
  interval.ts    Wilson intervals, and whether two versions are separable at all
  stability.ts   the same system N times over, flakiness detection
  screening.ts   the system under test — four versions of name screening
  cases.ts       the 22 check cases, each with its reason for existing
  server.ts + ui.html    one screen, French or English
```

Node 26 with native TypeScript, `node:test`, no build step, no dependencies.

The harness knows nothing about screening — a system under test is any function
`(input) => output`. A bench that knows its subject only ever serves that subject.

Two details worth the trouble:

**An exception fails the case, never the run.** A bench that stops at the first crash tells
you nothing about the cases after it, and that's often where the information is.

**Duration is reported in milliseconds and percent, or not at all.** The first version
announced "+1416 %" on a two-millisecond difference — a percentage over a tiny base is
noise dressed as signal, which is precisely what this project exists to complain about.

The watchlist and every name in it are fictional.

---

## What it doesn't do

- **No LLM adapters shipped.** The harness takes any function; wiring a model to it is a
  few lines, but nothing here pretends to have measured one.
- **Small samples, and it says so.** Twenty-two cases put a ±14 point interval on any
  rate quoted here. The bench reports that interval rather than hiding it, and refuses to
  call a rate difference an improvement when the case set cannot support the claim. What
  it does *not* do is tell you how many cases you would need — that depends on the effect
  you care about, and inventing a number would be the same failing again.
- **No cost tracking.** Duration is recorded; tokens and money are not.

---

Part of a set of three: [document search that refuses when it doesn't
know](https://github.com/ArslaneSempai-ui/compliance-document-search), [an onboarding
agent that escalates when it isn't
confident](https://github.com/ArslaneSempai-ui/kyc-triage-agent), and this — the bench
that says whether either of them still works.

**Arslane Chaouche Ramdane** — six years in AML/KYC and financial crime operations,
moving into AI transformation work.
