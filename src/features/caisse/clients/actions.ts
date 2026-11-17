"use server";

import { fusionnerClients, motifTelephone, type ClientTrouve, type FicheBrute } from "@/lib/caisse/clients";
import { createClient } from "@/lib/supabase/server";

type Ligne = Record<string, unknown>;

function texte(v: unknown) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function filtre(colonnes: string[], saisie: string) {
  const tel = motifTelephone(saisie);
  if (tel) return [colonnes.filter((c) => c.includes("phone") || c === "telephone").map((c) => `${c}.ilike.${tel}`).join(",")];
  return saisie
    .replace(/[%,()*\\"']/g, " ")
    .split(/\s+/)
    .filter((m) => m.length >= 2)
    .slice(0, 3)
    .map((mot) => colonnes.filter((c) => !c.includes("phone") && c !== "telephone").map((c) => `${c}.ilike.%${mot}%`).join(","));
}

export async function chercherClients(saisie: string): Promise<ClientTrouve[]> {
  const recherche = saisie.trim();
  if (recherche.length < 2) return [];
  const supabase = await createClient();

  let dossiers = supabase
    .from("prise_en_charge")
    .select("nom, prenom, telephone, email, date_reception")
    .order("id", { ascending: false })
    .limit(20);
  for (const f of filtre(["nom", "prenom", "telephone"], recherche)) dossiers = dossiers.or(f);

  let factures = supabase
    .from("invoices")
    .select(
      "customer_type, customer_first_name, customer_last_name, customer_address, customer_phone, customer_email, customer_siren, customer_vat_number, invoice_date",
    )
    .neq("status", "draft")
    .order("invoice_date", { ascending: false })
    .limit(20);
  for (const f of filtre(["customer_first_name", "customer_last_name", "customer_phone"], recherche)) factures = factures.or(f);

  let hiboutik = supabase
    .from("clients_caisse")
    .select("nom, prenom, telephone, email, n_tva, dernier_achat")
    .order("dernier_achat", { ascending: false, nullsFirst: false })
    .limit(20);
  for (const f of filtre(["nom", "prenom", "telephone"], recherche)) hiboutik = hiboutik.or(f);

  const [d, fa, h] = await Promise.all([dossiers, factures, hiboutik]);
  const fiches: FicheBrute[] = [];

  for (const r of (d.data ?? []) as Ligne[]) {
    fiches.push({
      type: "individual",
      prenom: texte(r.prenom),
      nom: texte(r.nom),
      telephone: texte(r.telephone),
      email: texte(r.email),
      adresse: "",
      siren: "",
      tva: "",
      dernier: texte(r.date_reception) || null,
      source: "atelier",
    });
  }
  for (const r of (fa.data ?? []) as Ligne[]) {
    const pro = r.customer_type === "business";
    fiches.push({
      type: pro ? "business" : "individual",
      prenom: pro ? "" : texte(r.customer_first_name),
      nom: texte(r.customer_last_name),
      telephone: texte(r.customer_phone),
      email: texte(r.customer_email),
      adresse: texte(r.customer_address),
      siren: texte(r.customer_siren),
      tva: texte(r.customer_vat_number),
      dernier: texte(r.invoice_date) || null,
      source: "facture",
    });
  }
  for (const r of (h.data ?? []) as Ligne[]) {
    fiches.push({
      type: "individual",
      prenom: texte(r.prenom),
      nom: texte(r.nom),
      telephone: texte(r.telephone),
      email: texte(r.email),
      adresse: "",
      siren: "",
      tva: texte(r.n_tva),
      dernier: texte(r.dernier_achat) || null,
      source: "hiboutik",
    });
  }

  return fusionnerClients(fiches);
}
