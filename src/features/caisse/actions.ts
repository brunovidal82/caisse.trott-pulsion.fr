"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lireMontant } from "@/lib/format";
import {
  COOKIE_VENDEUR,
  DUREE_SESSION_SECONDES,
  vendeurConnecte,
} from "@/lib/caisse/session";
import { createClient } from "@/lib/supabase/server";

export type EtatFormulaire = { erreur?: string };

export async function connecterVendeur(
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const vendeurId = formData.get("vendeur_id");
  const pin = formData.get("pin");

  if (typeof vendeurId !== "string" || !vendeurId) {
    return { erreur: "Choisis un vendeur." };
  }
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
    return { erreur: "Le code fait 4 à 6 chiffres." };
  }

  const supabase = await createClient();
  const { data: sessionId, error } = await supabase
    .schema("caisse")
    .rpc("connexion", { p_vendeur_id: vendeurId, p_pin: pin });

  if (error) return { erreur: error.message };
  if (!sessionId) return { erreur: "Code incorrect." };

  (await cookies()).set(COOKIE_VENDEUR, sessionId as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_SESSION_SECONDES,
  });

  redirect("/");
}

export async function changerVendeur() {
  const vendeur = await vendeurConnecte();
  if (vendeur) {
    const supabase = await createClient();
    await supabase
      .schema("caisse")
      .rpc("deconnexion", { p_session: vendeur.sessionId });
  }
  (await cookies()).delete(COOKIE_VENDEUR);
  redirect("/vendeur");
}

export async function quitterCaisse() {
  const vendeur = await vendeurConnecte();
  const supabase = await createClient();
  if (vendeur) {
    await supabase
      .schema("caisse")
      .rpc("deconnexion", { p_session: vendeur.sessionId });
  }
  (await cookies()).delete(COOKIE_VENDEUR);
  await supabase.auth.signOut();
  redirect("/login");
}

export async function ouvrirJournee(
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) redirect("/vendeur");

  const fond = lireMontant(formData.get("fond"));
  if (fond === null) {
    return { erreur: "Montant invalide (ex. 150 ou 150,50)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .schema("caisse")
    .rpc("ouvrir_journee", { p_session: vendeur.sessionId, p_fond: fond });

  if (error) return { erreur: error.message };
  revalidatePath("/", "layout");
  redirect("/");
}
