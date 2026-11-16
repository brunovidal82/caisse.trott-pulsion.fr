"use server";

import { revalidatePath } from "next/cache";
import type { Paiement } from "@/lib/caisse/panier";
import { marqueDe } from "@/lib/caisse/marques";
import { vendeurConnecte } from "@/lib/caisse/session";
import { createClient } from "@/lib/supabase/server";

export type ProduitCaisse = {
  id: number;
  code: string;
  designation: string;
  prixTtc: number;
  tauxTva: number;
  categorie: string | null;
  stock: number | null;
  photo: string | null;
  marque: string;
};

type LigneProduit = {
  id: number;
  code: string | null;
  designation: string | null;
  sale_price: number | string | null;
  vat_rate: number | string | null;
  category: string | null;
  brand: string | null;
  images: unknown;
};

const COLONNES = "id, code, designation, sale_price, vat_rate, category, brand, images";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

function urlPhoto(valeur: string): string | null {
  const texte = valeur.trim();
  if (!texte) return null;
  if (/^https?:\/\//.test(texte)) return texte;
  if (texte.startsWith("//")) return `https:${texte}`;
  const chemin = texte.replace(/^\/+/, "").replace(/^product-images\//, "");
  return URL_SUPABASE ? `${URL_SUPABASE}/storage/v1/object/public/product-images/${chemin}` : null;
}

function premierePhoto(images: unknown): string | null {
  if (typeof images === "string") {
    const texte = images.trim();
    if (texte.startsWith("[")) {
      try {
        return premierePhoto(JSON.parse(texte));
      } catch {
        return null;
      }
    }
    return urlPhoto(texte);
  }
  if (!Array.isArray(images)) return null;
  for (const image of images) {
    if (typeof image !== "string") continue;
    const url = urlPhoto(image);
    if (url) return url;
  }
  return null;
}

async function avecStock(lignes: LigneProduit[]): Promise<ProduitCaisse[]> {
  if (lignes.length === 0) return [];
  const supabase = await createClient();
  const { data: stocks } = await supabase
    .from("stock_produits")
    .select("produit_id, stock_actuel")
    .in(
      "produit_id",
      lignes.map((l) => l.id),
    );
  const parProduit = new Map<number, number>(
    (stocks ?? []).map((s: { produit_id: number; stock_actuel: number | string | null }) => [
      s.produit_id,
      Number(s.stock_actuel ?? 0),
    ]),
  );
  return lignes.map((l) => ({
    id: l.id,
    code: (l.code ?? "").trim(),
    designation: (l.designation ?? "").trim() || (l.code ?? "Article"),
    prixTtc: Number(l.sale_price ?? 0),
    tauxTva: Number(l.vat_rate ?? 20),
    categorie: l.category,
    stock: parProduit.has(l.id) ? (parProduit.get(l.id) as number) : null,
    photo: premierePhoto(l.images),
    marque: marqueDe(l.brand, l.designation),
  }));
}

function motsRecherche(saisie: string) {
  return saisie
    .replace(/[%,()*\\"']/g, " ")
    .split(/\s+/)
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function rechercherProduits(saisie: string): Promise<ProduitCaisse[]> {
  const mots = motsRecherche(saisie);
  if (mots.length === 0) return [];
  const supabase = await createClient();
  let requete = supabase.from("products").select(COLONNES).order("designation").limit(40);
  for (const mot of mots) {
    requete = requete.or(`code.ilike.%${mot}%,designation.ilike.%${mot}%`);
  }
  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return avecStock((data ?? []) as LigneProduit[]);
}

export async function produitParCode(code: string): Promise<ProduitCaisse | null> {
  const propre = code.trim();
  if (!propre) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(COLONNES)
    .ilike("code", propre)
    .limit(2);
  if (error) throw new Error(error.message);
  if (!data || data.length !== 1) return null;
  const [produit] = await avecStock(data as LigneProduit[]);
  return produit ?? null;
}

export async function produitsDeCategorie(categorie: string): Promise<ProduitCaisse[]> {
  const supabase = await createClient();
  const requete = (masquerCaches: boolean) => {
    const base = supabase.from("products").select(COLONNES).eq("category", categorie);
    return (masquerCaches ? base.eq("afficher_en_caisse", true) : base).order("designation").limit(300);
  };
  let { data, error } = await requete(true);
  if (error?.code === "42703") {
    ({ data, error } = await requete(false));
  }
  if (error) throw new Error(error.message);
  return avecStock((data ?? []) as LigneProduit[]);
}

export type AvoirInfo = {
  numero?: string;
  montant?: number;
  client_nom?: string | null;
  expire_le?: string;
  statut: "valide" | "expire" | "utilise" | "introuvable";
};

export async function verifierAvoir(numero: string): Promise<AvoirInfo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("caisse")
    .rpc("verifier_avoir", { p_numero: numero });
  if (error) throw new Error(error.message);
  return data as AvoirInfo;
}

export type VenteAEnregistrer = {
  dossierId: number | null;
  clientId: string | null;
  clientNom: string | null;
  acomptes: string[];
  lignes: {
    type: "produit" | "main_oeuvre" | "divers";
    produitId: number | null;
    code: string | null;
    designation: string;
    quantite: number;
    prixUnitaireTtc: number;
    remiseTtc: number;
    tauxTva: number;
  }[];
  paiements: Paiement[];
};

export type ResultatVente =
  | { ok: true; ticketId: string; numero: number; totalTtc: number; rendu: number }
  | { ok: false; erreur: string };

export async function encaisserVente(vente: VenteAEnregistrer): Promise<ResultatVente> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) return { ok: false, erreur: "Session vendeur expirée, reconnecte-toi." };

  const supabase = await createClient();
  const { data, error } = await supabase.schema("caisse").rpc("enregistrer_vente", {
    p_session: vendeur.sessionId,
    p_vente: {
      dossier_id: vente.dossierId,
      client_id: vente.clientId,
      client_nom: vente.clientNom,
      acomptes: vente.acomptes,
      lignes: vente.lignes.map((l) => ({
        type: l.type,
        produit_id: l.produitId,
        code: l.code,
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ttc: l.prixUnitaireTtc,
        remise_ttc: l.remiseTtc,
        taux_tva: l.tauxTva,
      })),
      paiements: vente.paiements.map((p) => ({
        moyen: p.moyen,
        montant: p.montant,
        especes_recues: p.especesRecues ?? null,
        avoir_numero: p.avoirNumero ?? null,
      })),
    },
  });

  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/", "layout");

  const resultat = data as { ticket_id: string; numero: number; total_ttc: number; rendu: number };
  return {
    ok: true,
    ticketId: resultat.ticket_id,
    numero: resultat.numero,
    totalTtc: Number(resultat.total_ttc),
    rendu: Number(resultat.rendu),
  };
}
