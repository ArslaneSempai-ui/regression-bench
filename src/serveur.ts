import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { executions, relire } from "./banc.ts";
import { comparer } from "./diff.ts";
import { mesurerStabilite } from "./stabilite.ts";
import { toutLancer } from "./lancer.ts";
import { VERSIONS } from "./criblage.ts";
import { JEU } from "./jeu.ts";

const PORT = Number(process.env.PORT ?? 4600);

function json(res: ServerResponse, corps: unknown, code = 200): void {
  const charge = JSON.stringify(corps);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(charge),
  });
  res.end(charge);
}

/** Le jeu, indexé : l'écran doit pouvoir montrer l'entrée et le pourquoi d'un cas. */
const parCas = Object.fromEntries(JEU.map((c) => [c.id, { entree: c.entree, pourquoi: c.pourquoi }]));

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/") {
      const html = readFileSync(new URL("./ui.html", import.meta.url).pathname, "utf8");
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, must-revalidate",
      });
      res.end(html);
      return;
    }

    if (url.pathname === "/registre.css") {
      const css = readFileSync(new URL("./registre.css", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" });
      res.end(css);
      return;
    }

    if (url.pathname === "/api/etat") {
      return json(res, {
        executions: executions().map((e) => ({
          version: e.version, le: e.le, reussis: e.reussis, total: e.total, taux: e.taux,
        })),
        cas: parCas,
        totalCas: JEU.length,
      });
    }

    if (url.pathname === "/api/lancer" && req.method === "POST") {
      await toutLancer();
      return json(res, { executions: executions().map((e) => ({
        version: e.version, le: e.le, reussis: e.reussis, total: e.total, taux: e.taux,
      })) });
    }

    if (url.pathname === "/api/comparer") {
      const a = relire(url.searchParams.get("avant") ?? "");
      const b = relire(url.searchParams.get("apres") ?? "");
      if (!a || !b) return json(res, { erreur: "execution_introuvable" }, 404);
      return json(res, comparer(a, b));
    }

    if (url.pathname === "/api/stabilite" && req.method === "POST") {
      const tours = Number(url.searchParams.get("tours") ?? 8);
      const toutes = [];
      for (const [nom, systeme] of Object.entries(VERSIONS)) {
        toutes.push(await mesurerStabilite(nom, systeme, JEU, tours));
      }
      return json(res, { tours, versions: toutes });
    }

    res.writeHead(404).end("introuvable");
  } catch (erreur) {
    json(res, { erreur: erreur instanceof Error ? erreur.message : String(erreur) }, 500);
  }
});

// Un banc vide n'a rien à montrer : on lance les versions au démarrage.
if (executions().length === 0) await toutLancer();

/*
 * On écoute la boucle locale, pas toutes les interfaces.
 *
 * `listen(PORT)` seul fait écouter Node sur `::` — l'outil devient joignable par
 * n'importe qui sur le même réseau. Sur le wifi d'un café, ça expose un écran qui lit
 * des dossiers clients.
 */
serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Banc de régression → http://localhost:${PORT}`);
});
