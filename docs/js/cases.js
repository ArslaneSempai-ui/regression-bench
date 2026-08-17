/**
 * The case set.
 *
 * Every case carries a "why". It is the most useful rule in the whole project: a case
 * nobody knows the purpose of gets deleted the day it becomes inconvenient, usually by
 * the person who introduced the bug it was catching.
 *
 * The "why" is bilingual. A case set is documentation as much as it is a test — leaving it
 * in one language makes it unreadable to half the people expected to maintain it.
 *
 * The negative cases — the ones that must NOT match — are almost as
 * nombreux que les positifs. Un jeu qui ne contient que des correspondances attendues
 * rewards a system that says yes to everything.
 */
export const CASES = [
    // --- literal matches
    { id: "exact-01", input: "Amina Haddad", expected: "Amina Haddad",
        why: { fr: "Le cas trivial. S'il casse, tout casse.",
            en: "The trivial case. If it breaks, everything breaks." } },
    { id: "exact-02", input: "Viktor Alexeyevich Morozov", expected: "Viktor Alexeyevich Morozov",
        why: { fr: "Nom long, saisi correctement.", en: "A long name, entered correctly." } },
    // --- ce que la casse et les accents cassent
    { id: "casse-01", input: "AMINA HADDAD", expected: "Amina Haddad",
        why: { fr: "Saisie en majuscules — current dans les imports bancaires.",
            en: "All caps — common in bank data imports." } },
    { id: "accent-01", input: "Jean Baptiste NDiaye", expected: "Jean-Baptiste N'Diaye",
        why: { fr: "Apostrophe et tiret perdus par un système amont.",
            en: "Apostrophe and hyphen stripped by an upstream system." } },
    { id: "espaces-01", input: "  Olga   Petrova ", expected: "Olga Petrova",
        why: { fr: "Espaces multiples, fréquents après un copier-coller.",
            en: "Repeated whitespace, common after a copy-paste." } },
    // --- ordre des mots
    { id: "ordre-01", input: "Haddad Amina", expected: "Amina Haddad",
        why: { fr: "Nom et prénom inversés — la moitié des référentiels le font.",
            en: "Surname and given name swapped — half of all registries do this." } },
    { id: "ordre-02", input: "Morozov Viktor Alexeyevich", expected: "Viktor Alexeyevich Morozov",
        why: { fr: "Inversion sur un name à trois éléments.",
            en: "Swap on a three-part name." } },
    // --- typos and transliteration
    { id: "faute-01", input: "Amina Haddadd", expected: "Amina Haddad",
        why: { fr: "Une lettre doublée à la saisie.", en: "A doubled letter at entry." } },
    { id: "faute-02", input: "Olga Petrovna", expected: "Olga Petrova",
        why: { fr: "Translittération alternative d'un name russe.",
            en: "An alternative transliteration of a Russian name." } },
    { id: "faute-03", input: "Ahmad Reza Khorassani", expected: "Ahmad Reza Khorasani",
        why: { fr: "Faute sur un name long : la tolérance doit suivre la longueur.",
            en: "A typo in a long name: tolerance must scale with length." } },
    // --- ce qui ne doit PAS correspondre
    { id: "negatif-01", input: "Amina Benali", expected: null,
        why: { fr: "Homonyme partiel : un prénom commun ne suffit pas.",
            en: "Partial namesake: a shared given name is not a match." } },
    { id: "negatif-02", input: "Thomas Lindqvist", expected: null,
        why: { fr: "Nom absent de la liste, sans ressemblance.",
            en: "Not on the list, and resembling nothing on it." } },
    { id: "negatif-03", input: "Grupo Financiero Delta", expected: null,
        why: { fr: "Société au name voisin mais distincte.",
            en: "A company with a neighbouring but distinct name." } },
    { id: "negatif-04", input: "", expected: null,
        why: { fr: "Chaîne vide : ne doit jamais correspondre à quoi que ce soit.",
            en: "Empty string: must never match anything." } },
    { id: "negatif-05", input: "Petrova", expected: null,
        why: { fr: "Un seul mot de la liste ne fait pas une correspondance.",
            en: "One word from a listed name is not a match." } },
    /*
     * Les noms courts. C'est ici que la version approximative se casse la figure, et
     * these are exactly the cases the bench exists for: they passed, they were validated,
     * and an improvement in the average is about to take them away unnoticed.
     */
    { id: "court-01", input: "Li Wen", expected: null,
        why: { fr: "« Li Wen » n'est pas « Li Wei » : une lettre, deux personnes.",
            en: "“Li Wen” is not “Li Wei”: one letter, two different people." } },
    { id: "court-02", input: "Li Wai", expected: null,
        why: { fr: "Même piège, autre lettre.", en: "The same trap, a different letter." } },
    { id: "court-03", input: "Li Wei", expected: "Li Wei",
        why: { fr: "Le name court exact doit malgré tout correspondre.",
            en: "The short name, entered exactly, must still match." } },
    { id: "court-04", input: "Li", expected: null,
        why: { fr: "Prénom seul, très court : jamais une correspondance.",
            en: "A single very short name fragment: never a match." } },
    // --- companies
    { id: "societe-01", input: "Sociedad Comercial del Norte", expected: "Sociedad Comercial del Norte",
        why: { fr: "Raison sociale exacte.", en: "Exact company name." } },
    { id: "societe-02", input: "SOCIEDAD COMERCIAL DEL NORTE", expected: "Sociedad Comercial del Norte",
        why: { fr: "Casse différente sur une raison sociale.",
            en: "Different casing on a company name." } },
    { id: "societe-03", input: "Grupo Financiero Vega", expected: "Grupo Financiero Vega",
        why: { fr: "Forme juridique ajoutée : ne doit pas empêcher la détection.",
            en: "Legal form appended: must not prevent detection." } },
];
