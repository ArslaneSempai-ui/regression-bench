/**
 * Le jeu de contrôle.
 *
 * Chaque cas porte un « pourquoi ». C'est la règle la plus utile de tout le projet : un
 * cas dont personne ne sait à quoi il sert finit par être supprimé le jour où il gêne,
 * généralement par la personne qui a introduit le bogue qu'il détectait.
 *
 * Le « pourquoi » est bilingue. Un jeu de contrôle est de la documentation autant qu'un
 * test — le laisser dans une seule langue le rend illisible pour la moitié des gens
 * censés le maintenir.
 *
 * Les cas négatifs — ceux qui ne doivent PAS correspondre — sont ici presque aussi
 * nombreux que les positifs. Un jeu qui ne contient que des correspondances attendues
 * récompense un système qui dit oui à tout.
 */

import type { Cas } from "./banc.ts";
import type { Correspondance } from "./criblage.ts";

export const JEU: Cas<string, Correspondance>[] = [
  // --- correspondances littérales
  { id: "exact-01", entree: "Amina Haddad", attendu: "Amina Haddad",
    pourquoi: { fr: "Le cas trivial. S'il casse, tout casse.",
                en: "The trivial case. If it breaks, everything breaks." } },
  { id: "exact-02", entree: "Viktor Alexeyevich Morozov", attendu: "Viktor Alexeyevich Morozov",
    pourquoi: { fr: "Nom long, saisi correctement.", en: "A long name, entered correctly." } },

  // --- ce que la casse et les accents cassent
  { id: "casse-01", entree: "AMINA HADDAD", attendu: "Amina Haddad",
    pourquoi: { fr: "Saisie en majuscules — courant dans les imports bancaires.",
                en: "All caps — common in bank data imports." } },
  { id: "accent-01", entree: "Jean Baptiste NDiaye", attendu: "Jean-Baptiste N'Diaye",
    pourquoi: { fr: "Apostrophe et tiret perdus par un système amont.",
                en: "Apostrophe and hyphen stripped by an upstream system." } },
  { id: "espaces-01", entree: "  Olga   Petrova ", attendu: "Olga Petrova",
    pourquoi: { fr: "Espaces multiples, fréquents après un copier-coller.",
                en: "Repeated whitespace, common after a copy-paste." } },

  // --- ordre des mots
  { id: "ordre-01", entree: "Haddad Amina", attendu: "Amina Haddad",
    pourquoi: { fr: "Nom et prénom inversés — la moitié des référentiels le font.",
                en: "Surname and given name swapped — half of all registries do this." } },
  { id: "ordre-02", entree: "Morozov Viktor Alexeyevich", attendu: "Viktor Alexeyevich Morozov",
    pourquoi: { fr: "Inversion sur un nom à trois éléments.",
                en: "Swap on a three-part name." } },

  // --- fautes de frappe et translittération
  { id: "faute-01", entree: "Amina Haddadd", attendu: "Amina Haddad",
    pourquoi: { fr: "Une lettre doublée à la saisie.", en: "A doubled letter at entry." } },
  { id: "faute-02", entree: "Olga Petrovna", attendu: "Olga Petrova",
    pourquoi: { fr: "Translittération alternative d'un nom russe.",
                en: "An alternative transliteration of a Russian name." } },
  { id: "faute-03", entree: "Ahmad Reza Khorassani", attendu: "Ahmad Reza Khorasani",
    pourquoi: { fr: "Faute sur un nom long : la tolérance doit suivre la longueur.",
                en: "A typo in a long name: tolerance must scale with length." } },

  // --- ce qui ne doit PAS correspondre
  { id: "negatif-01", entree: "Amina Benali", attendu: null,
    pourquoi: { fr: "Homonyme partiel : un prénom commun ne suffit pas.",
                en: "Partial namesake: a shared given name is not a match." } },
  { id: "negatif-02", entree: "Thomas Lindqvist", attendu: null,
    pourquoi: { fr: "Nom absent de la liste, sans ressemblance.",
                en: "Not on the list, and resembling nothing on it." } },
  { id: "negatif-03", entree: "Grupo Financiero Delta", attendu: null,
    pourquoi: { fr: "Société au nom voisin mais distincte.",
                en: "A company with a neighbouring but distinct name." } },
  { id: "negatif-04", entree: "", attendu: null,
    pourquoi: { fr: "Chaîne vide : ne doit jamais correspondre à quoi que ce soit.",
                en: "Empty string: must never match anything." } },
  { id: "negatif-05", entree: "Petrova", attendu: null,
    pourquoi: { fr: "Un seul mot de la liste ne fait pas une correspondance.",
                en: "One word from a listed name is not a match." } },

  /*
   * Les noms courts. C'est ici que la version approximative se casse la figure, et
   * c'est pour ces cas précis que le banc existe : ils passaient, ils ont été validés,
   * et une amélioration de la moyenne va les emporter sans que personne le remarque.
   */
  { id: "court-01", entree: "Li Wen", attendu: null,
    pourquoi: { fr: "« Li Wen » n'est pas « Li Wei » : une lettre, deux personnes.",
                en: "“Li Wen” is not “Li Wei”: one letter, two different people." } },
  { id: "court-02", entree: "Li Wai", attendu: null,
    pourquoi: { fr: "Même piège, autre lettre.", en: "The same trap, a different letter." } },
  { id: "court-03", entree: "Li Wei", attendu: "Li Wei",
    pourquoi: { fr: "Le nom court exact doit malgré tout correspondre.",
                en: "The short name, entered exactly, must still match." } },
  { id: "court-04", entree: "Li", attendu: null,
    pourquoi: { fr: "Prénom seul, très court : jamais une correspondance.",
                en: "A single very short name fragment: never a match." } },

  // --- sociétés
  { id: "societe-01", entree: "Sociedad Comercial del Norte", attendu: "Sociedad Comercial del Norte",
    pourquoi: { fr: "Raison sociale exacte.", en: "Exact company name." } },
  { id: "societe-02", entree: "SOCIEDAD COMERCIAL DEL NORTE", attendu: "Sociedad Comercial del Norte",
    pourquoi: { fr: "Casse différente sur une raison sociale.",
                en: "Different casing on a company name." } },
  { id: "societe-03", entree: "Grupo Financiero Vega", attendu: "Grupo Financiero Vega",
    pourquoi: { fr: "Forme juridique ajoutée : ne doit pas empêcher la détection.",
                en: "Legal form appended: must not prevent detection." } },
];
