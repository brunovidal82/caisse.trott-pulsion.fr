"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bornesPeriode, dateParis, periodesPrecedentes } from "@/lib/caisse/cloture";
import { vendeurConnecte } from "@/lib/caisse/session";
import { lireMontant } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type EtatCloture = { erreur?: string; ecartAConfirmer?: number };

type Client = Awaited<ReturnType<typeof createClient>>;

async function cloturerPeriodeSiBesoin(supabase: Client, sessionId: string, type: "mois" | "an", periode: string) {
  const caisse = supabase.schema("caisse");
  const { data: dejaFaite } = await caisse
    .from("clotures")
    .select("id")
    .eq("type", type)
    .eq("periode", periode)
    .maybeSingle();
  if (dejaFaite) return;

  const { debut, fin } = bornesPeriode(periode);
  const { count } = await caisse
    .from("journees")
    .select("id", { count: "exact", head: true })
    .gte("ouverte_le", `${debut}T00:00:00+01:00`)
    .lt("ouverte_le", `${fin}T00:00:00+01:00`);
  if (!count) return;

  const { error } = await caisse.rpc("cloturer_periode", {
    p_session: sessionId,
    p_type: type,
    p_periode: periode,
  });
  if (error) console.warn(`Clôture ${type} ${periode} non faite : ${error.message}`);
}

export async function cloturerJournee(_etat: EtatCloture, formData: FormData): Promise<EtatCloture> {
  const vendeur = await vendeurConnecte();
  if (!vendeur) redirect("/vendeur");

  const comptees = lireMontant(formData.get("comptees"));
  const fond = lireMontant(formData.get("fond"));
  const attendues = Number(formData.get("attendues"));
  if (comptees === null) return { erreur: "Saisis les espèces comptées (ex. 370,20)." };
  if (fond === null) return { erreur: "Saisis le fond laissé pour demain." };
  if (fond > comptees) return { erreur: "Le fond laissé ne peut pas dépasser les espèces comptées." };

  const ecart = Math.round((comptees - attendues) * 100) / 100;
  if (Math.abs(ecart) >= 0.01 && formData.get("ecart_confirme") !== "1") {
    return { ecartAConfirmer: ecart };
  }

  const supabase = await createClient();
  const { data: clotureId, error } = await supabase.schema("caisse").rpc("cloturer_journee", {
    p_session: vendeur.sessionId,
    p_especes_comptees: comptees,
    p_fond_laisse: fond,
  });
  if (error) return { erreur: error.message };

  const { mois, an } = periodesPrecedentes(dateParis());
  await cloturerPeriodeSiBesoin(supabase, vendeur.sessionId, "mois", mois);
  await cloturerPeriodeSiBesoin(supabase, vendeur.sessionId, "an", an);

  revalidatePath("/", "layout");
  redirect(`/z/${clotureId as string}?impression=1`);
}
