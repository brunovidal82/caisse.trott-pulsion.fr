"use server";

import { revalidatePath } from "next/cache";
import { journeeOuverte, vendeurConnecte } from "@/lib/caisse/session";
import { createClient } from "@/lib/supabase/server";

export type Moyen = "cb" | "especes" | "virement" | "avoir";
export type TypeTicket = "vente" | "annulation" | "acompte";

export type TicketResume = {
  id: string;
  numero: number;
  type: TypeTicket;
  creeLe: string;
  vendeur: string;
  clientNom: string | null;
  totalTtc: number;
  moyens: Moyen[];
  origineNumero: number | null;
  annule: "non" | "partiel" | "total";
};

export type LigneDetail = {
  id: string;
  type: string;
  designation: string;
  quantite: number;
  prixUnitaireTtc: number;
  remiseTtc: number;
  totalTtc: number;
  dejaQuantite: number;
  dejaTtc: number;
};

export type TicketDetail = TicketResume & {
  motif: string | null;
  dossierId: number | null;
  lignes: LigneDetail[];
  paiements: { moyen: Moyen; montant: number; especesRecues: number | null; rendu: number | null }[];
  annulations: { id: string; numero: number; totalTtc: number; motif: string | null }[];
  acompteDeduit: boolean;
  journeeOuverte: boolean;
  facture: { invoiceId: string; numero: string | null } | null;
};

type LigneTicket = {
  id: string;
  numero: number;
  type: TypeTicket;
  cree_le: string;
  client_nom: string | null;
  total_ttc: number;
  ticket_origine_id: string | null;
  motif: string | null;
  dossier_id: number | null;
  journee_id: string;
  vendeurs: { prenom: string } | { prenom: string }[] | null;
};

const COLONNES =
  "id, numero, type, cree_le, client_nom, total_ttc, ticket_origine_id, motif, dossier_id, journee_id, vendeurs(prenom)";

function prenom(v: LigneTicket["vendeurs"]) {
  const vendeur = Array.isArray(v) ? v[0] : v;
  return vendeur?.prenom ?? "—";
}

async function enrichir(lignes: LigneTicket[]): Promise<TicketResume[]> {
  if (lignes.length === 0) return [];
  const supabase = await createClient();
  const caisse = supabase.schema("caisse");
  const ids = lignes.map((t) => t.id);
  const origines = lignes.map((t) => t.ticket_origine_id).filter((v): v is string => Boolean(v));

  const [{ data: paiements }, { data: annulations }, { data: numerosOrigine }] = await Promise.all([
    caisse.from("paiements").select("ticket_id, moyen").in("ticket_id", ids),
    caisse.from("tickets").select("ticket_origine_id").eq("type", "annulation").in("ticket_origine_id", ids),
    origines.length
      ? caisse.from("tickets").select("id, numero").in("id", origines)
      : Promise.resolve({ data: [] as { id: string; numero: number }[] }),
  ]);

  const idsAnnules = [
    ...new Set(((annulations ?? []) as { ticket_origine_id: string }[]).map((a) => a.ticket_origine_id)),
  ];
  const { data: lignesVente } = idsAnnules.length
    ? await caisse.from("lignes").select("id, ticket_id, quantite").in("ticket_id", idsAnnules).neq("type", "acompte_deduit")
    : { data: [] as { id: string; ticket_id: string; quantite: number }[] };
  const idsLignesVente = ((lignesVente ?? []) as { id: string }[]).map((l) => l.id);
  const { data: lignesAnnulees } = idsLignesVente.length
    ? await caisse.from("lignes").select("ligne_origine_id, quantite").in("ligne_origine_id", idsLignesVente)
    : { data: [] as { ligne_origine_id: string; quantite: number }[] };

  const moyensParTicket = new Map<string, Set<Moyen>>();
  for (const p of (paiements ?? []) as { ticket_id: string; moyen: Moyen }[]) {
    const set = moyensParTicket.get(p.ticket_id) ?? new Set<Moyen>();
    set.add(p.moyen);
    moyensParTicket.set(p.ticket_id, set);
  }
  const annulesIds = new Set(idsAnnules);
  const numeroParId = new Map(((numerosOrigine ?? []) as { id: string; numero: number }[]).map((t) => [t.id, t.numero]));

  const dejaParLigne = new Map<string, number>();
  for (const l of (lignesAnnulees ?? []) as { ligne_origine_id: string; quantite: number }[]) {
    dejaParLigne.set(l.ligne_origine_id, (dejaParLigne.get(l.ligne_origine_id) ?? 0) - Number(l.quantite));
  }
  const resteParTicket = new Map<string, number>();
  for (const l of (lignesVente ?? []) as { id: string; ticket_id: string; quantite: number }[]) {
    const reste = Number(l.quantite) - (dejaParLigne.get(l.id) ?? 0);
    resteParTicket.set(l.ticket_id, (resteParTicket.get(l.ticket_id) ?? 0) + Math.max(reste, 0));
  }

  return lignes.map((t) => {
    const annule: TicketResume["annule"] = !annulesIds.has(t.id)
      ? "non"
      : (resteParTicket.get(t.id) ?? 0) <= 0.0005
        ? "total"
        : "partiel";
    return {
      id: t.id,
      numero: t.numero,
      type: t.type,
      creeLe: t.cree_le,
      vendeur: prenom(t.vendeurs),
      clientNom: t.client_nom,
      totalTtc: Number(t.total_ttc),
      moyens: [...(moyensParTicket.get(t.id) ?? [])],
      origineNumero: t.ticket_origine_id ? (numeroParId.get(t.ticket_origine_id) ?? null) : null,
      annule,
    };
  });
}

export async function listerTickets(recherche: string): Promise<{ tickets: TicketResume[]; portee: string }> {
  const supabase = await createClient();
  const caisse = supabase.schema("caisse");
  const saisie = recherche.trim();

  let requete = caisse.from("tickets").select(COLONNES).order("numero", { ascending: false }).limit(60);
  let portee: string;

  const numero = saisie.match(/^(?:t\s*-?\s*)?0*(\d{1,9})$/i);
  const montant = saisie.match(/^-?\d+[,.]\d{1,2}$/) || saisie.match(/^-?\d+\s*€$/);

  if (!saisie) {
    const journee = await journeeOuverte();
    portee = journee ? `Derniers tickets · journée n°${journee.numero} en cours` : "Derniers tickets";
  } else if (montant) {
    const valeur = Number(saisie.replace("€", "").replace(",", ".").trim());
    requete = requete.in("total_ttc", [valeur, -valeur]);
    portee = `Montant ${saisie}`;
  } else if (numero) {
    requete = requete.eq("numero", Number(numero[1]));
    portee = `Ticket n°${numero[1]}`;
  } else {
    const propre = saisie.replace(/[%,()*\\"']/g, " ").trim();
    requete = requete.ilike("client_nom", `%${propre}%`);
    portee = `Client « ${saisie} »`;
  }

  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return { tickets: await enrichir((data ?? []) as LigneTicket[]), portee };
}

export async function detailTicket(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const caisse = supabase.schema("caisse");
  const { data: ticket } = await caisse.from("tickets").select(COLONNES).eq("id", id).maybeSingle<LigneTicket>();
  if (!ticket) return null;

  const [[resume], { data: lignes }, { data: paiements }, { data: annulations }, { data: deduit }, journee] =
    await Promise.all([
      enrichir([ticket]),
      caisse
        .from("lignes")
        .select("id, type, designation, quantite, prix_unitaire_ttc, remise_ttc, total_ttc")
        .eq("ticket_id", id)
        .neq("type", "acompte_deduit")
        .order("ordre"),
      caisse.from("paiements").select("moyen, montant, especes_recues, rendu").eq("ticket_id", id),
      caisse
        .from("tickets")
        .select("id, numero, total_ttc, motif")
        .eq("ticket_origine_id", id)
        .order("numero"),
      caisse.from("lignes").select("id").eq("acompte_ticket_id", id).limit(1),
      journeeOuverte(),
    ]);

  const { data: lien } = await caisse
    .from("factures")
    .select("invoice_id")
    .eq("ticket_id", id)
    .maybeSingle<{ invoice_id: string }>();
  let facture: TicketDetail["facture"] = null;
  if (lien) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("id", lien.invoice_id)
      .maybeSingle<{ invoice_number: string | null }>();
    facture = { invoiceId: lien.invoice_id, numero: invoice?.invoice_number ?? null };
  }

  const idsLignes = ((lignes ?? []) as { id: string }[]).map((l) => l.id);
  const { data: deja } = idsLignes.length
    ? await caisse.from("lignes").select("ligne_origine_id, quantite, total_ttc").in("ligne_origine_id", idsLignes)
    : { data: [] as { ligne_origine_id: string; quantite: number; total_ttc: number }[] };
  const dejaParLigne = new Map<string, { q: number; ttc: number }>();
  for (const d of (deja ?? []) as { ligne_origine_id: string; quantite: number; total_ttc: number }[]) {
    const cumul = dejaParLigne.get(d.ligne_origine_id) ?? { q: 0, ttc: 0 };
    dejaParLigne.set(d.ligne_origine_id, { q: cumul.q - Number(d.quantite), ttc: cumul.ttc - Number(d.total_ttc) });
  }

  return {
    ...resume,
    motif: ticket.motif,
    dossierId: ticket.dossier_id,
    lignes: (
      (lignes ?? []) as {
        id: string;
        type: string;
        designation: string;
        quantite: number;
        prix_unitaire_ttc: number;
        remise_ttc: number;
        total_ttc: number;
      }[]
    ).map((l) => ({
      id: l.id,
      type: l.type,
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaireTtc: Number(l.prix_unitaire_ttc),
      remiseTtc: Number(l.remise_ttc),
      totalTtc: Number(l.total_ttc),
      dejaQuantite: Math.round((dejaParLigne.get(l.id)?.q ?? 0) * 1000) / 1000,
      dejaTtc: Math.round((dejaParLigne.get(l.id)?.ttc ?? 0) * 100) / 100,
    })),
    paiements: (
      (paiements ?? []) as { moyen: Moyen; montant: number; especes_recues: number | null; rendu: number | null }[]
    ).map((p) => ({
      moyen: p.moyen,
      montant: Number(p.montant),
      especesRecues: p.especes_recues === null ? null : Number(p.especes_recues),
      rendu: p.rendu === null ? null : Number(p.rendu),
    })),
    annulations: ((annulations ?? []) as { id: string; numero: number; total_ttc: number; motif: string | null }[]).map(
      (a) => ({ id: a.id, numero: a.numero, totalTtc: Number(a.total_ttc), motif: a.motif }),
    ),
    acompteDeduit: ((deduit ?? []) as unknown[]).length > 0,
    journeeOuverte: journee !== null,
    facture,
  };
}

export type ResultatAnnulation =
  | {
      ok: true;
      ticketId: string;
      numero: number;
      totalTtc: number;
      remboursement: "cb" | "especes" | "avoir";
      avoirNumero: string | null;
      avoirExpireLe: string | null;
    }
  | { ok: false; erreur: string };

export async function annulerTicket(demande: {
  ticketId: string;
  motif: string;
  remboursement: "cb" | "especes" | "avoir";
  lignes: { ligneId: string; quantite: number }[] | null;
}): Promise<ResultatAnnulation> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) return { ok: false, erreur: "Session vendeur expirée, reconnecte-toi." };
  if (!demande.motif.trim()) return { ok: false, erreur: "Le motif est obligatoire." };

  const supabase = await createClient();
  const { data, error } = await supabase.schema("caisse").rpc("annuler_ticket", {
    p_session: vendeur.sessionId,
    p_annulation: {
      ticket_id: demande.ticketId,
      motif: demande.motif.trim(),
      remboursement: demande.remboursement,
      ...(demande.lignes
        ? { lignes: demande.lignes.map((l) => ({ ligne_id: l.ligneId, quantite: l.quantite })) }
        : {}),
    },
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/", "layout");
  const r = data as {
    ticket_id: string;
    numero: number;
    total_ttc: number;
    remboursement: "cb" | "especes" | "avoir";
    avoir_numero: string | null;
    avoir_expire_le: string | null;
  };
  return {
    ok: true,
    ticketId: r.ticket_id,
    numero: r.numero,
    totalTtc: Number(r.total_ttc),
    remboursement: r.remboursement,
    avoirNumero: r.avoir_numero,
    avoirExpireLe: r.avoir_expire_le,
  };
}

export async function noterDuplicata(ticketId: string): Promise<{ ok: true; numero: number } | { ok: false; erreur: string }> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) return { ok: false, erreur: "Session vendeur expirée, reconnecte-toi." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("caisse")
    .rpc("noter_duplicata", { p_session: vendeur.sessionId, p_ticket: ticketId });
  if (error) return { ok: false, erreur: error.message };
  return { ok: true, numero: Number(data) };
}
