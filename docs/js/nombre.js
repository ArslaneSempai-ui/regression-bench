/**
 * LIRE UN NOMBRE FOURNI PAR QUELQU'UN D'AUTRE.
 *
 * `Number("")` et `Number("   ")` valent **zéro**, pas `NaN`. Zéro passe `Number.isFinite`,
 * zéro passe toutes les gardes écrites après la conversion, et zéro est une valeur
 * parfaitement plausible — c'est ce qui rend ce défaut muet. La conversion doit donc venir
 * APRÈS la question « m'a-t-on donné quelque chose ? », jamais avant.
 *
 * La forme fautive est presque toujours la même, et elle a l'air correcte :
 *
 *     const tours = Number(q.get("runs") ?? 8);     // ?runs=  →  0, pas 8
 *
 * `??` ne se déclenche que sur `null` et `undefined`. Un paramètre PRÉSENT ET VIDE n'est
 * ni l'un ni l'autre : `URLSearchParams.get` rend `""`, une variable d'environnement posée
 * sans valeur rend `""`, une cellule vide rend `""`. Le défaut ne se répare donc pas en
 * ajoutant une borne — mesuré dans ce dépôt même : la borne `Math.max(1, …)` ramenait
 * sagement le zéro à 1, et **rendait le défaut invisible en le rendant plausible**.
 *
 * Ce que ça coûtait ici, sur la démo publiée : `?runs=` donnait zéro tour de mesure de
 * stabilité, donc aucun cas observé, donc aucun cas instable, donc **les quatre versions
 * annoncées stables** — `v4-sous-budget` compris, la version que toute cette démonstration
 * existe pour montrer instable. Le contraire exact de la thèse de l'outil, servi sans une
 * erreur ni un avertissement.
 *
 * Écrit une fois et partagé par le serveur, la démo et les deux commandes : trois copies
 * d'une même affirmation ne valent pas trois fois plus sûr, ce sont trois occasions de
 * diverger — et ce dépôt en a déjà fait l'expérience, le serveur ayant été réparé pendant
 * que la démo publiée gardait la faute.
 */
/**
 * Un entier borné, lu depuis une chaîne dont on ne contrôle pas la provenance.
 *
 * On regarde la CHAÎNE avant de convertir. Vide, blanche ou non numérique signifie
 * « non fourni » et vaut le défaut ; un nombre hors bornes est ramené ET signalé, parce
 * qu'une valeur rabotée sans un mot fait chercher pourquoi le résultat ne bouge plus.
 */
export function entierBorne(brut, defaut, min = 1, max = Number.POSITIVE_INFINITY) {
    const fourni = brut !== null && brut !== undefined
        && brut.trim() !== "" && Number.isFinite(Number(brut));
    const demande = fourni ? Math.trunc(Number(brut)) : defaut;
    const valeur = Math.min(Math.max(min, demande), max);
    return { valeur, fourni, ramene: fourni && valeur !== demande };
}
