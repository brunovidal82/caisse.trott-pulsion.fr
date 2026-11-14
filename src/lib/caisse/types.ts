export type LigneDossier = {
  produit_id: number | null;
  code: string | null;
  designation: string | null;
  quantite: number;
  prix_unitaire_ttc: number;
  taux_tva: number;
};

export type AcompteDossier = {
  ticket_id: string;
  numero: number;
  montant: number;
  le: string;
};

export type DossierPret = {
  dossier_id: number;
  client_id: string | null;
  client_nom: string;
  telephone: string | null;
  marque_modele: string | null;
  date_reception: string | null;
  prefacture_id: number | null;
  lignes: LigneDossier[];
  acomptes: AcompteDossier[];
};

export type ApercuJournee = {
  nb_tickets: number;
  total_ttc: number;
  detail_moyens: Partial<Record<"cb" | "especes" | "virement" | "avoir", number>>;
};
