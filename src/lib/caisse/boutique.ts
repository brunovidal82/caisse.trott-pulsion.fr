export const BOUTIQUE = {
  enseigne: "TROTT PULSION",
  lignes: [
    "SARL BBE",
    "113 Faubourg Lacapelle, 82000 Montauban",
    "SIREN 941 127 136 · RCS Montauban",
    "TVA FR92941127136",
  ],
  caisse: "Caisse 1",
  merci: "Merci de votre visite",
} as const;

export const URL_FORMULAIREDB = (
  process.env.NEXT_PUBLIC_FORMULAIREDB_URL ?? "https://formulaire-db-react.vercel.app"
).replace(/\/$/, "");
