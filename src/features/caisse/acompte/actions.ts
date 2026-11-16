"use server";

import { revalidatePath } from "next/cache";
import type { Paiement } from "@/lib/caisse/panier";
import { vendeurConnecte } from "@/lib/caisse/session";
import { createClient } from "@/lib/supabase/server";

export type DossierAcompte = {
  id: number;
  clientId: string | null;
  clientNom: string;
  telephone: string | null;
  marqueModele: string | null;
  statut: string | null;
  dateReception: string | null;
  devis: number | null;
  acomptes: { ticketId: string; numero: number; montant: number }[];
};

type LigneDossier = {
  id: number;
  client_id: string | null;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  marque_modele: string | null;
  status: string | null;
  date_reception: string | null;
  montant: number | string | null;
};

const STATUTS_OUVERTS = ["DEPOSE", "EN_COURS", "TERMINE"];

export async function chercherDossiers(saisie: string): Promise<DossierAcompte[]> {
  const supabase = await createClient();
  const texte = saisie.trim();
  let requete = supabase
    .from("prise_en_charge")
    .select("id, client_id, nom, prenom, telephone, marque_modele, status, date_reception, montant")
    .in("status", STATUTS_OUVERTS)
    .order("id", { ascending: false })
    .limit(15);

  if (/^\d+$/.test(texte)) {
    requete = requete.eq("id", Number(texte));
  } else if (texte) {
    for (const mot of texte.replace(/[%,()*\\"']/g, " ").split(/\s+/).filter(Boolean).slice(0, 4)) {
      requete = requete.or(`nom.ilike.%${mot}%,prenom.ilike.%${mot}%,marque_modele.ilike.%${mot}%,telephone.ilike.%${mot}%`);
    }
  }

  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  const dossiers = (data ?? []) as LigneDossier[];
  if (dossiers.length === 0) return [];

  const caisse = supabase.schema("caisse");
  const { data: acomptes } = await caisse
    .from("tickets")
    .select("id, numero, total_ttc, dossier_id")
    .eq("type", "acompte")
    .in(
      "dossier_id",
      dossiers.map((d) => d.id),
    );
  const idsAcomptes = ((acomptes ?? []) as { id: string }[]).map((a) => a.id);
  const [{ data: annules }, { data: deduits }] = idsAcomptes.length
    ? await Promise.all([
        caisse.from("tickets").select("ticket_origine_id").in("ticket_origine_id", idsAcomptes),
        caisse.from("lignes").select("acompte_ticket_id").in("acompte_ticket_id", idsAcomptes),
      ])
    : [{ data: [] }, { data: [] }];
  const exclus = new Set([
    ...((annules ?? []) as { ticket_origine_id: string }[]).map((a) => a.ticket_origine_id),
    ...((deduits ?? []) as { acompte_ticket_id: string }[]).map((d) => d.acompte_ticket_id),
  ]);

  return dossiers.map((d) => ({
    id: d.id,
    clientId: d.client_id,
    clientNom: [d.prenom, d.nom].map((v) => (v ?? "").trim()).filter(Boolean).join(" "),
    telephone: d.telephone,
    marqueModele: d.marque_modele,
    statut: d.status,
    dateReception: d.date_reception,
    devis: d.montant === null || d.montant === "" ? null : Number(d.montant) || null,
    acomptes: ((acomptes ?? []) as { id: string; numero: number; total_ttc: number; dossier_id: number }[])
      .filter((a) => a.dossier_id === d.id && !exclus.has(a.id))
      .map((a) => ({ ticketId: a.id, numero: a.numero, montant: Number(a.total_ttc) })),
  }));
}

export type ResultatAcompte =
  | { ok: true; ticketId: string; numero: number; totalTtc: number; rendu: number }
  | { ok: false; erreur: string };

export async function encaisserAcompte(demande: {
  dossierId: number;
  montant: number;
  clientId: string | null;
  clientNom: string | null;
  paiements: Paiement[];
}): Promise<ResultatAcompte> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) return { ok: false, erreur: "Session vendeur expirée, reconnecte-toi." };

  const supabase = await createClient();
  const { data, error } = await supabase.schema("caisse").rpc("enregistrer_acompte", {
    p_session: vendeur.sessionId,
    p_acompte: {
      dossier_id: demande.dossierId,
      montant: demande.montant,
      taux_tva: 20,
      client_id: demande.clientId,
      client_nom: demande.clientNom,
      paiements: demande.paiements.map((p) => ({
        moyen: p.moyen,
        montant: p.montant,
        ...(p.especesRecues !== undefined ? { especes_recues: p.especesRecues } : {}),
        ...(p.avoirNumero ? { avoir_numero: p.avoirNumero } : {}),
      })),
    },
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/", "layout");
  const r = data as { ticket_id: string; numero: number; total_ttc: number; rendu: number };
  return { ok: true, ticketId: r.ticket_id, numero: r.numero, totalTtc: Number(r.total_ttc), rendu: Number(r.rendu) };
}
