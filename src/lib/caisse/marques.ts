const MARQUES_CONNUES = [
  "Dualtron",
  "Teverun",
  "Nami",
  "Kingsong",
  "Inmotion",
  "Segway",
  "Ninebot",
  "Xiaomi",
  "Kukirin",
  "Rovoron",
  "Hikerboy",
  "Punk Electric",
  "Phscoo",
  "Odyssey",
  "Vsett",
  "Kaabo",
  "Zero",
  "Minimotors",
  "iScooter",
  "Begode",
  "Leaperkim",
  "Veteran",
  "Gotway",
  "Mobilityurban",
] as const;

export const SANS_MARQUE = "Autres";

function normaliser(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function marqueDe(marque: string | null | undefined, designation: string | null | undefined): string {
  const saisie = (marque ?? "").trim();
  if (saisie) {
    const connue = MARQUES_CONNUES.find((m) => normaliser(m) === normaliser(saisie));
    return connue ?? saisie.charAt(0).toUpperCase() + saisie.slice(1);
  }
  const texte = ` ${normaliser(designation ?? "")} `;
  const trouvee = MARQUES_CONNUES.find((m) => texte.includes(` ${normaliser(m)} `));
  return trouvee ?? SANS_MARQUE;
}

export function compterMarques<T extends { marque: string }>(articles: T[]) {
  const compte = new Map<string, number>();
  for (const a of articles) compte.set(a.marque, (compte.get(a.marque) ?? 0) + 1);
  return [...compte.entries()]
    .sort(([a], [b]) => {
      if (a === SANS_MARQUE) return 1;
      if (b === SANS_MARQUE) return -1;
      return a.localeCompare(b, "fr");
    })
    .map(([marque, nombre]) => ({ marque, nombre }));
}

export function trierParMarque<T extends { marque: string; designation: string }>(articles: T[]) {
  return [...articles].sort((a, b) => {
    if (a.marque !== b.marque) {
      if (a.marque === SANS_MARQUE) return 1;
      if (b.marque === SANS_MARQUE) return -1;
      return a.marque.localeCompare(b.marque, "fr");
    }
    return a.designation.localeCompare(b.designation, "fr");
  });
}
