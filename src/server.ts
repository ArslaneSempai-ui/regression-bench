import { createServer, type ServerResponse, type IncomingMessage } from "node:http";
import { brancherDisque } from "./store.ts";
import { readFileSync } from "node:fs";
import { runs, load } from "./bench.ts";
import { compare } from "./diff.ts";
import { measureStability } from "./stability.ts";
import { runAll } from "./run.ts";
import { VERSIONS } from "./screening.ts";
import { REFERENCE_STABILITE } from "./reference-stabilite.ts";
import { CASES } from "./cases.ts";
import { fileURLToPath } from "node:url";

/* Runs persist to disk when the bench is driven from Node; the browser build keeps
 * them in memory instead — see `bench.ts`. */
brancherDisque();

const PORT = Number(process.env.PORT ?? 4600);

function json(res: ServerResponse, body: unknown, code = 200): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** The set, indexed: the screen has to be able to show a case's input and its reason. */
const byCase = Object.fromEntries(CASES.map((c) => [c.id, { input: c.input, why: c.why }]));

/**
 * IS THIS REQUEST COMING FROM A PAGE THIS SERVER DID NOT SERVE?
 *
 * Listening on the loopback puts the tool out of reach of the NETWORK, not out of reach of
 * the BROWSER. Any page the user happens to open can POST to `localhost`: in simple form
 * there is no preflight, and the absence of CORS headers only stops the attacker READING
 * the reply — the state has already changed by then. Here `POST /api/run` starts the whole
 * measurement campaign, so a page in another tab could spend twenty minutes of the user's
 * machine.
 *
 * COMPARED TO THE REQUEST'S OWN HOST, NOT TO A WRITTEN LIST. The first shape anyone reaches
 * for is `origin === "http://localhost:4670"`, and it refuses this server's OWN screen the
 * moment someone serves it under another name — a port chosen with PORT=, a demo machine, a
 * proxy. A guard that refuses legitimate use is removed at the first complaint, and it takes
 * the hole with it. A page served BY this server necessarily carries the same host as the
 * request it makes; a hostile page carries another. That is both more permissive for real
 * use and exactly as strict against the attack.
 *
 * No `Origin` at all is allowed through: that is curl, a test, a same-origin form. Browsers
 * send it on every cross-origin request, which is the case this guards.
 */
function origineEtrangere(req: IncomingMessage): boolean {
  const origine = req.headers.origin;
  if (!origine) return false;
  try {
    return new URL(origine).host !== req.headers.host;
  } catch {
    /* An Origin that does not parse is not one this server served. */
    return true;
  }
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  /*
   * Only the methods that change something. A cross-origin GET cannot be read back without
   * CORS headers, and refusing it would break nothing an attacker could use — but it would
   * break embedding this screen in a page, which is a legitimate thing to want.
   */
  if (req.method !== "GET" && req.method !== "HEAD" && origineEtrangere(req)) {
    return json(res, {
      erreur: "origine_etrangere",
      dit: "cette requête vient d'une page que ce serveur n'a pas servie",
    }, 403);
  }

  try {
    if (url.pathname === "/") {
      const html = readFileSync(fileURLToPath(new URL("./ui.html", import.meta.url)), "utf8");
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, must-revalidate",
      });
      res.end(html);
      return;
    }

    if (url.pathname === "/graphes.js") {
      const js = readFileSync(fileURLToPath(new URL("./graphes.js", import.meta.url)), "utf8");
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      res.end(js);
      return;
    }

    if (url.pathname === "/registre.css") {
      const css = readFileSync(fileURLToPath(new URL("./registre.css", import.meta.url)), "utf8");
      res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" });
      res.end(css);
      return;
    }

    if (url.pathname === "/api/state") {
      return json(res, {
        runs: runs().map((e) => ({
          version: e.version, le: e.le, passed: e.passed, total: e.total, rate: e.rate,
        })),
        cases: byCase,
        totalCases: CASES.length,
        /*
         * Le résultat de chaque cas, version par version.
         *
         * La thèse de cet outil est qu'un taux qui monte peut cacher un cas qui vient de
         * casser — et jusqu'ici il l'affichait sous forme de taux, en demandant au lecteur
         * de cliquer « comparer » et de lire une liste pour trouver la casse. Les taux ne
         * suffisent pas à la dessiner : il faut les cas eux-mêmes. Vingt-deux booléens par
         * version, c'est le prix de la démonstration.
         */
        grille: {
          cas: CASES.map((c) => c.id),
          /* La grille se lit sur une mesure datée, pas sur l'exécution du moment : une des
           * versions court après une horloge, et aucun nombre de tours ne fige son verdict.
           * Voir figer-stabilite.ts. */
          reference: REFERENCE_STABILITE,
          versions: runs().map((e) => ({
            version: e.version,
            passes: CASES.map((c) => e.results.find((r) => r.caseId === c.id)?.passed ?? null),
          })),
        },
      });
    }

    if (url.pathname === "/api/run" && req.method === "POST") {
      await runAll();
      return json(res, { runs: runs().map((e) => ({
        version: e.version, le: e.le, passed: e.passed, total: e.total, rate: e.rate,
      })) });
    }

    if (url.pathname === "/api/compare") {
      const a = load(url.searchParams.get("before") ?? "");
      const b = load(url.searchParams.get("after") ?? "");
      if (!a || !b) return json(res, { error: "execution_introuvable" }, 404);
      return json(res, compare(a, b));
    }

    if (url.pathname === "/api/stability" && req.method === "POST") {
      /*
       * BORNÉ, parce que le nombre vient de la requête et que la route CALCULE.
       *
       * `?runs=100000` sur une route qui exécute la suite autant de fois est le même geste
       * que l'origine étrangère sous une autre forme : ce n'est pas une lecture, c'est du
       * temps machine pris à quelqu'un. La borne est haute — vingt-cinq tours dépassent
       * largement ce qu'on demande à la main — et elle est dite plutôt que silencieuse :
       * une valeur rabotée sans un mot fait chercher pourquoi le résultat ne bouge plus.
       */
      /*
       * LA BORNE ETAIT LE MASQUE, PAS LA PARADE. Mesure sur mon propre code, six heures
       * apres l'avoir ecrit :
       *
       *   ?runs=        -> 1      alors que l'absence donne 8
       *   ?runs=%20%20  -> 1      idem
       *
       * `Number("")` et `Number("   ")` valent ZERO, pas NaN. Zero passe `isFinite`, et le
       * clamp le range sagement sur la borne basse — donc un parametre vide ne retombe pas
       * sur le defaut, il tombe au minimum, sans un mot. **La borne rendait le defaut
       * invisible en le rendant plausible**, ce qui est pire que de ne pas l'avoir : un 1
       * silencieux se lit comme un choix.
       *
       * On regarde donc la CHAINE avant de convertir. Vide, blanche ou non numerique
       * signifie « non fourni » et vaut le defaut ; un nombre hors borne est ramene ET
       * annonce.
       */
      const brut = url.searchParams.get("runs");
      const fourni = brut !== null && brut.trim() !== "" && Number.isFinite(Number(brut));
      const demande = fourni ? Number(brut) : 8;
      const runs = Math.min(Math.max(1, Math.trunc(demande)), 25);
      if (fourni && runs !== demande) {
        console.warn(`  runs=${brut} ramené à ${runs} — borne 1..25`);
      }
      const toutes = [];
      for (const [name, system] of Object.entries(VERSIONS)) {
        toutes.push(await measureStability(name, system, CASES, runs));
      }
      return json(res, { runs, versions: toutes });
    }

    res.writeHead(404).end("introuvable");
  } catch (error) {
    json(res, { error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// An empty bench has nothing to show, so the versions run at startup.
if (runs().length === 0) await runAll();

/*
 * Bind the loopback interface, not every interface.
 *
 * `listen(PORT)` on its own has Node listen on `::` — the tool becomes reachable by
 * anyone on the same network. On a café wifi that exposes a screen which reads
 * des dossiers clients.
 */
serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Regression bench → http://localhost:${PORT}`);
});
