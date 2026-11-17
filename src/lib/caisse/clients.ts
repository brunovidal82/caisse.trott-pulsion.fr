export type ClientTrouve = {
  cle: string;
  type: "individual" | "business";
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  siren: string;
  tva: string;
  sources: string[];
  dernier: string | null;
};

export type FicheBrute = Omit<ClientTrouve, "cle" | "sources"> & { source: string };

export function chiffres(texte: string) {
  return texte.replace(/\D/g, "");
}

function sansAccents(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function cleClient(fiche: Pick<FicheBrute, "telephone" | "prenom" | "nom">) {
  const tel = chiffres(fiche.telephone);
  if (tel.length >= 9) return `tel:${tel.slice(-9)}`;
  return `nom:${sansAccents(`${fiche.prenom} ${fiche.nom}`)}`;
}

export function motifTelephone(saisie: string) {
  const c = chiffres(saisie);
  return c.length >= 4 && c.length === saisie.replace(/[\s.+-]/g, "").length ? `%${c.split("").join("%")}%` : null;
}

export function fusionnerClients(fiches: FicheBrute[], limite = 8): ClientTrouve[] {
  const parCle = new Map<string, ClientTrouve>();
  for (const f of fiches) {
    if (!f.nom.trim() && !f.prenom.trim()) continue;
    const cle = cleClient(f);
    const actuel = parCle.get(cle);
    if (!actuel) {
      parCle.set(cle, { ...f, cle, sources: [f.source] });
      continue;
    }
    const plusRecent = (f.dernier ?? "") > (actuel.dernier ?? "");
    const choisir = (a: string, b: string) => (plusRecent ? b || a : a || b);
    parCle.set(cle, {
      cle,
      type: actuel.type === "business" || f.type === "business" ? "business" : "individual",
      prenom: choisir(actuel.prenom, f.prenom),
      nom: choisir(actuel.nom, f.nom),
      telephone: choisir(actuel.telephone, f.telephone),
      email: choisir(actuel.email, f.email),
      adresse: choisir(actuel.adresse, f.adresse),
      siren: choisir(actuel.siren, f.siren),
      tva: choisir(actuel.tva, f.tva),
      sources: actuel.sources.includes(f.source) ? actuel.sources : [...actuel.sources, f.source],
      dernier: plusRecent ? f.dernier : actuel.dernier,
    });
  }
  return [...parCle.values()].sort((a, b) => (b.dernier ?? "").localeCompare(a.dernier ?? "")).slice(0, limite);
}
