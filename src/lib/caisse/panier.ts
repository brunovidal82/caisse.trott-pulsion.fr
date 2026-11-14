export type TypeLigne = "produit" | "main_oeuvre" | "divers";

export type LignePanier = {
  cle: string;
  type: TypeLigne;
  produitId: number | null;
  code: string | null;
  designation: string;
  quantite: number;
  prixUnitaireTtc: number;
  remiseTtc: number;
  tauxTva: number;
  stock: number | null;
  origine: "dossier" | "manuel";
  photo?: string | null;
  categorie?: string | null;
};

export type Acompte = { ticketId: string; numero: number; montant: number };

export type Paiement = {
  moyen: "cb" | "especes" | "virement" | "avoir";
  montant: number;
  especesRecues?: number;
  avoirNumero?: string;
};

export const TAUX_TVA = [20, 10, 5.5, 2.1, 0] as const;

export function enCentimes(montant: number) {
  return Math.round(montant * 100);
}

export function enEuros(centimes: number) {
  return centimes / 100;
}

function arrondiDivision(numerateur: number, denominateur: number) {
  const signe = numerateur < 0 ? -1 : 1;
  return signe * Math.floor((Math.abs(numerateur) * 2 + denominateur) / (2 * denominateur));
}

export function ttcLigneCentimes(ligne: Pick<LignePanier, "quantite" | "prixUnitaireTtc" | "remiseTtc">) {
  const quantiteMilliemes = Math.round(ligne.quantite * 1000);
  const brut = arrondiDivision(quantiteMilliemes * enCentimes(ligne.prixUnitaireTtc), 1000);
  return brut - enCentimes(ligne.remiseTtc);
}

export function htDepuisTtcCentimes(ttcCentimes: number, tauxTva: number) {
  return arrondiDivision(ttcCentimes * 1000, 1000 + Math.round(tauxTva * 10));
}

export type Totaux = {
  ht: number;
  tva: number;
  ttc: number;
  acomptes: number;
  aPayer: number;
  parTaux: { taux: number; ht: number; tva: number; ttc: number }[];
};

export function calculerTotaux(lignes: LignePanier[], acomptes: Acompte[] = []): Totaux {
  const parTaux = new Map<number, { ht: number; ttc: number }>();
  for (const ligne of lignes) {
    const ttc = ttcLigneCentimes(ligne);
    const ht = htDepuisTtcCentimes(ttc, ligne.tauxTva);
    const cumul = parTaux.get(ligne.tauxTva) ?? { ht: 0, ttc: 0 };
    parTaux.set(ligne.tauxTva, { ht: cumul.ht + ht, ttc: cumul.ttc + ttc });
  }
  const detail = [...parTaux.entries()]
    .sort(([a], [b]) => b - a)
    .map(([taux, { ht, ttc }]) => ({
      taux,
      ht: enEuros(ht),
      tva: enEuros(ttc - ht),
      ttc: enEuros(ttc),
    }));
  const ttc = [...parTaux.values()].reduce((s, v) => s + v.ttc, 0);
  const ht = [...parTaux.values()].reduce((s, v) => s + v.ht, 0);
  const acompte = acomptes.reduce((s, a) => s + enCentimes(a.montant), 0);
  return {
    ht: enEuros(ht),
    tva: enEuros(ttc - ht),
    ttc: enEuros(ttc),
    acomptes: enEuros(acompte),
    aPayer: enEuros(ttc - acompte),
    parTaux: detail,
  };
}

export function totalPaiements(paiements: Paiement[]) {
  return enEuros(paiements.reduce((s, p) => s + enCentimes(p.montant), 0));
}

export function resteAPayer(aPayer: number, paiements: Paiement[]) {
  return enEuros(enCentimes(aPayer) - enCentimes(totalPaiements(paiements)));
}

export function renduMonnaie(paiements: Paiement[]) {
  return enEuros(
    paiements.reduce(
      (s, p) =>
        p.moyen === "especes" && p.especesRecues !== undefined
          ? s + enCentimes(p.especesRecues) - enCentimes(p.montant)
          : s,
      0,
    ),
  );
}

export function billetsRapides(montant: number) {
  const centimes = enCentimes(montant);
  const auDessus = (pas: number) => (Math.floor(centimes / pas) + 1) * pas;
  const propositions = new Set([
    auDessus(500),
    auDessus(1000),
    auDessus(1000) + 1000,
    auDessus(1000) + 2000,
    auDessus(5000),
    auDessus(10000),
  ]);
  return [...propositions].sort((a, b) => a - b).slice(0, 4).map(enEuros);
}

export function numeroTicket(numero: number) {
  return `T-${String(numero).padStart(4, "0")}`;
}
