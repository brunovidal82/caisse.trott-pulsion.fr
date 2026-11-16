import { enCentimes, enEuros } from "./panier";

export type LigneAnnulable = {
  id: string;
  quantite: number;
  totalTtc: number;
  dejaQuantite: number;
  dejaTtc: number;
};

export function resteAnnulable(ligne: LigneAnnulable) {
  return Math.round((ligne.quantite - ligne.dejaQuantite) * 1000) / 1000;
}

export function montantAnnule(ligne: LigneAnnulable, quantite: number) {
  if (quantite <= 0) return 0;
  const reste = resteAnnulable(ligne);
  if (quantite >= reste) return enEuros(enCentimes(ligne.totalTtc) - enCentimes(ligne.dejaTtc));
  const centimes = (enCentimes(ligne.totalTtc) * quantite) / ligne.quantite;
  return enEuros(Math.sign(centimes) * Math.floor(Math.abs(centimes) + 0.5));
}

export function totalRembourse(lignes: LigneAnnulable[], quantites: Record<string, number>) {
  return enEuros(lignes.reduce((s, l) => s + enCentimes(montantAnnule(l, quantites[l.id] ?? 0)), 0));
}

export const MOTIFS = ["Erreur de saisie", "Retour produit", "Erreur de prix", "Geste commercial"] as const;
