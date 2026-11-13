import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const COOKIE_VENDEUR = "tp_caisse_vendeur";
export const DUREE_SESSION_SECONDES = 12 * 60 * 60;

export type Vendeur = {
  sessionId: string;
  vendeurId: string;
  prenom: string;
  role: "admin" | "vendeur";
};

export type Journee = {
  id: string;
  numero: number;
  ouverte_le: string;
  ouverte_par: string;
  fond_ouverture: number;
  nb_tickets: number;
  total_ttc: number;
};

type LigneSession = {
  id: string;
  vendeur_id: string;
  expire_le: string;
  fermee_le: string | null;
  vendeurs:
    | { prenom: string; role: Vendeur["role"]; actif: boolean }
    | { prenom: string; role: Vendeur["role"]; actif: boolean }[]
    | null;
};

export const vendeurConnecte = cache(async (): Promise<Vendeur | null> => {
  const sessionId = (await cookies()).get(COOKIE_VENDEUR)?.value;
  if (!sessionId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .schema("caisse")
    .from("sessions")
    .select("id, vendeur_id, expire_le, fermee_le, vendeurs(prenom, role, actif)")
    .eq("id", sessionId)
    .maybeSingle<LigneSession>();

  if (!data || data.fermee_le || new Date(data.expire_le) <= new Date()) {
    return null;
  }

  const vendeur = Array.isArray(data.vendeurs) ? data.vendeurs[0] : data.vendeurs;
  if (!vendeur?.actif) return null;

  return {
    sessionId: data.id,
    vendeurId: data.vendeur_id,
    prenom: vendeur.prenom,
    role: vendeur.role,
  };
});

export const journeeOuverte = cache(async (): Promise<Journee | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("caisse").rpc("journee_ouverte");
  if (error) throw new Error(error.message);
  return (data as Journee | null) ?? null;
});
