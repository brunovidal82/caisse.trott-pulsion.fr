"use server";

import { revalidatePath } from "next/cache";
import { vendeurConnecte } from "@/lib/caisse/session";
import { createClient } from "@/lib/supabase/server";

export type ClientFacture = {
  type: "individual" | "business";
  prenom: string;
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  siren: string;
  tva: string;
};

type Ligne = {
  type: "produit" | "main_oeuvre" | "divers" | "acompte_deduit";
  code: string | null;
  designation: string;
  quantite: number;
  prix_unitaire_ttc: number;
  remise_ttc: number;
  taux_tva: number;
  total_ttc: number;
  acompte_ticket_id: string | null;
};

type PaiementCaisse = { ticket_id: string; moyen: "cb" | "especes" | "virement" | "avoir"; montant: number };

const METHODES = { cb: "CB", especes: "Espèces", virement: "Virement" } as const;

function numeroTicket(numero: number) {
  return `T-${String(numero).padStart(4, "0")}`;
}

export async function clientPourFacture(ticketId: string): Promise<ClientFacture> {
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .schema("caisse")
    .from("tickets")
    .select("client_nom, dossier_id")
    .eq("id", ticketId)
    .maybeSingle<{ client_nom: string | null; dossier_id: number | null }>();

  const vide: ClientFacture = { type: "individual", prenom: "", nom: "", adresse: "", telephone: "", email: "", siren: "", tva: "" };
  if (!ticket) return vide;

  if (ticket.dossier_id) {
    const { data: dossier } = await supabase
      .from("prise_en_charge")
      .select("nom, prenom, telephone, email")
      .eq("id", ticket.dossier_id)
      .maybeSingle<{ nom: string | null; prenom: string | null; telephone: string | null; email: string | null }>();
    if (dossier) {
      return {
        ...vide,
        prenom: dossier.prenom ?? "",
        nom: dossier.nom ?? "",
        telephone: dossier.telephone ?? "",
        email: dossier.email ?? "",
      };
    }
  }

  const morceaux = (ticket.client_nom ?? "").trim().split(/\s+/).filter(Boolean);
  return { ...vide, prenom: morceaux.length > 1 ? morceaux[0] : "", nom: morceaux.length > 1 ? morceaux.slice(1).join(" ") : (morceaux[0] ?? "") };
}

export type ResultatFacture =
  | { ok: true; invoiceId: string; numero: string; avertissement: string | null }
  | { ok: false; erreur: string };

export async function creerFacture(ticketId: string, client: ClientFacture): Promise<ResultatFacture> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) return { ok: false, erreur: "Session vendeur expirée, reconnecte-toi." };
  if (!client.nom.trim()) return { ok: false, erreur: client.type === "business" ? "Indique la raison sociale." : "Indique le nom du client." };
  if (client.type === "business" && (!client.adresse.trim() || !client.siren.trim())) {
    return { ok: false, erreur: "Client professionnel : adresse et SIREN obligatoires." };
  }

  const supabase = await createClient();
  const caisse = supabase.schema("caisse");

  const { data: ticket } = await caisse
    .from("tickets")
    .select("id, numero, type, cree_le, dossier_id")
    .eq("id", ticketId)
    .maybeSingle<{ id: string; numero: number; type: string; cree_le: string; dossier_id: number | null }>();
  if (!ticket || ticket.type !== "vente") return { ok: false, erreur: "Seul un ticket de vente peut être facturé." };

  const [{ data: dejaFacture }, { data: annulations }, { data: lignes }] = await Promise.all([
    caisse.from("factures").select("invoice_id").eq("ticket_id", ticketId).maybeSingle(),
    caisse.from("tickets").select("id").eq("ticket_origine_id", ticketId).limit(1),
    caisse
      .from("lignes")
      .select("type, code, designation, quantite, prix_unitaire_ttc, remise_ttc, taux_tva, total_ttc, acompte_ticket_id")
      .eq("ticket_id", ticketId)
      .order("ordre")
      .returns<Ligne[]>(),
  ]);
  if (dejaFacture) return { ok: false, erreur: "Ce ticket a déjà une facture." };
  if ((annulations ?? []).length > 0) {
    return { ok: false, erreur: "Ce ticket a été annulé, en tout ou en partie : fais la facture depuis FormulaireDB." };
  }

  const articles = (lignes ?? []).filter((l) => l.type !== "acompte_deduit");
  const idsAcomptes = (lignes ?? []).map((l) => l.acompte_ticket_id).filter((v): v is string => Boolean(v));

  const { data: paiementsBruts } = await caisse
    .from("paiements")
    .select("ticket_id, moyen, montant")
    .in("ticket_id", [ticketId, ...idsAcomptes])
    .returns<PaiementCaisse[]>();
  const paiements = (paiementsBruts ?? []).filter((p) => Number(p.montant) > 0);
  if (paiements.some((p) => p.moyen === "avoir")) {
    return {
      ok: false,
      erreur: "Une partie a été payée avec un avoir de caisse : ce moyen n'existe pas dans les factures, fais-la depuis FormulaireDB.",
    };
  }

  const date = new Date(ticket.cree_le).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const notes = [
    `Ticket de caisse ${numeroTicket(ticket.numero)}`,
    idsAcomptes.length ? `acompte${idsAcomptes.length > 1 ? "s" : ""} déjà versé${idsAcomptes.length > 1 ? "s" : ""} inclus dans les règlements` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  let marqueModele = "";
  if (ticket.dossier_id) {
    const { data: dossier } = await supabase
      .from("prise_en_charge")
      .select("marque_modele")
      .eq("id", ticket.dossier_id)
      .maybeSingle<{ marque_modele: string | null }>();
    marqueModele = dossier?.marque_modele ?? "";
  }

  const pro = client.type === "business";
  const header = {
    customer_type: client.type,
    customer_first_name: pro ? "" : client.prenom.trim(),
    customer_last_name: client.nom.trim(),
    customer_address: client.adresse.trim(),
    customer_phone: client.telephone.trim(),
    customer_email: client.email.trim(),
    customer_siren: pro ? client.siren.replace(/\s+/g, "") : "",
    customer_vat_number: pro ? client.tva.replace(/\s+/g, "").toUpperCase() : "",
    delivery_address: "",
    payment_terms_days: 0,
    service_date: date,
    notes,
    vehicle_brand: "",
    vehicle_model: marqueModele,
    vehicle_serial: "",
  };

  const items = articles.map((l) => {
    const quantite = Number(l.quantite);
    const remise = Number(l.remise_ttc);
    const regroupe = remise !== 0 && quantite !== 1;
    return {
      kind: l.type === "main_oeuvre" ? "service" : "good",
      source: "manual",
      product_id: null,
      reference: (l.code ?? "").slice(0, 60),
      designation: regroupe ? `${l.designation} (x${quantite})` : l.designation,
      quantity: regroupe ? 1 : quantite,
      unit_price_ttc: regroupe ? Number(l.total_ttc) : remise !== 0 ? Number(l.total_ttc) : Number(l.prix_unitaire_ttc),
      vat_rate: Number(l.taux_tva),
      comment: remise !== 0 ? `Remise ${remise.toFixed(2).replace(".", ",")} € incluse` : "",
    };
  });

  const { data: invoiceId, error: erreurBrouillon } = await supabase.rpc("enregistrer_brouillon_facture", {
    p_invoice_id: null,
    p_header: header,
    p_items: items,
  });
  if (erreurBrouillon || !invoiceId) return { ok: false, erreur: erreurBrouillon?.message ?? "Brouillon non créé." };

  const { data: validee, error: erreurValidation } = await supabase.rpc("valider_facture", {
    p_invoice_id: invoiceId,
  });
  if (erreurValidation) {
    await supabase.rpc("supprimer_facture_bbe", { p_invoice_id: invoiceId });
    return { ok: false, erreur: erreurValidation.message };
  }
  const numero = String((validee as { invoice_number?: string } | null)?.invoice_number ?? "");

  const avertissements: string[] = [];
  for (const p of paiements) {
    const { error } = await supabase.rpc("enregistrer_paiement_facture", {
      p_invoice_id: invoiceId,
      p_amount: Math.round(Number(p.montant) * 100) / 100,
      p_method: METHODES[p.moyen as keyof typeof METHODES],
      p_paid_at: date,
      p_note: p.ticket_id === ticketId ? `Ticket ${numeroTicket(ticket.numero)}` : "Acompte en caisse",
    });
    if (error) avertissements.push(`Règlement non reporté : ${error.message}`);
  }

  const { error: erreurLien } = await caisse.rpc("lier_facture", {
    p_session: vendeur.sessionId,
    p_ticket: ticketId,
    p_invoice: invoiceId,
  });
  if (erreurLien) avertissements.push(`Lien ticket ↔ facture non enregistré : ${erreurLien.message}`);

  revalidatePath("/tickets");
  return { ok: true, invoiceId: String(invoiceId), numero, avertissement: avertissements.join(" ") || null };
}
