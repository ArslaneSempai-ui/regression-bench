/*
 * Mesuré une fois, pas rejoué à chaque visite. Régénérer avec `npm run figer`.
 *
 * Pourquoi ce fichier existe plutôt qu'une mesure au chargement : voir figer-stabilite.ts.
 * En deux mots — une des versions court après une horloge, donc son verdict dépend de la
 * charge de la machine et aucun nombre de tours ne le fige.
 */

/** Combien de tours chaque cas a réussi, et l'étendue du taux, par version. */
export const REFERENCE_STABILITE = {
  "mesureLe": "2026-08-18T11:01:14.099Z",
  "tours": 400,
  "versions": {
    "v1-exact": {
      "passesParCas": {
        "exact-01": 400,
        "exact-02": 400,
        "casse-01": 0,
        "accent-01": 0,
        "espaces-01": 0,
        "ordre-01": 0,
        "ordre-02": 0,
        "faute-01": 0,
        "faute-02": 0,
        "faute-03": 0,
        "negatif-01": 400,
        "negatif-02": 400,
        "negatif-03": 400,
        "negatif-04": 400,
        "negatif-05": 400,
        "court-01": 400,
        "court-02": 400,
        "court-03": 400,
        "court-04": 400,
        "societe-01": 400,
        "societe-02": 0,
        "societe-03": 400
      },
      "taux": {
        "bas": 0.5909090909090909,
        "haut": 0.5909090909090909,
        "moyen": 0.590909090909093
      }
    },
    "v2-normalise": {
      "passesParCas": {
        "exact-01": 400,
        "exact-02": 400,
        "casse-01": 400,
        "accent-01": 0,
        "espaces-01": 400,
        "ordre-01": 400,
        "ordre-02": 400,
        "faute-01": 0,
        "faute-02": 0,
        "faute-03": 0,
        "negatif-01": 400,
        "negatif-02": 400,
        "negatif-03": 400,
        "negatif-04": 400,
        "negatif-05": 400,
        "court-01": 400,
        "court-02": 400,
        "court-03": 400,
        "court-04": 400,
        "societe-01": 400,
        "societe-02": 400,
        "societe-03": 400
      },
      "taux": {
        "bas": 0.8181818181818182,
        "haut": 0.8181818181818182,
        "moyen": 0.8181818181818141
      }
    },
    "v3-approximatif": {
      "passesParCas": {
        "exact-01": 400,
        "exact-02": 400,
        "casse-01": 400,
        "accent-01": 0,
        "espaces-01": 400,
        "ordre-01": 400,
        "ordre-02": 400,
        "faute-01": 400,
        "faute-02": 400,
        "faute-03": 400,
        "negatif-01": 400,
        "negatif-02": 400,
        "negatif-03": 400,
        "negatif-04": 400,
        "negatif-05": 400,
        "court-01": 0,
        "court-02": 0,
        "court-03": 400,
        "court-04": 400,
        "societe-01": 400,
        "societe-02": 400,
        "societe-03": 400
      },
      "taux": {
        "bas": 0.8636363636363636,
        "haut": 0.8636363636363636,
        "moyen": 0.8636363636363698
      }
    },
    "v4-sous-budget": {
      "passesParCas": {
        "exact-01": 400,
        "exact-02": 400,
        "casse-01": 400,
        "accent-01": 0,
        "espaces-01": 400,
        "ordre-01": 400,
        "ordre-02": 400,
        "faute-01": 383,
        "faute-02": 385,
        "faute-03": 379,
        "negatif-01": 400,
        "negatif-02": 400,
        "negatif-03": 400,
        "negatif-04": 400,
        "negatif-05": 400,
        "court-01": 1,
        "court-02": 7,
        "court-03": 400,
        "court-04": 400,
        "societe-01": 400,
        "societe-02": 400,
        "societe-03": 400
      },
      "taux": {
        "bas": 0.8181818181818182,
        "haut": 0.9090909090909091,
        "moyen": 0.8585227272727319
      }
    }
  }
} as const;
