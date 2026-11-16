import { OuvrirJournee } from "@/features/caisse/OuvrirJournee";
import { EcranVente } from "@/features/caisse/vente/EcranVente";
import { journeeOuverte } from "@/lib/caisse/session";
import type { ApercuJournee, DossierPret } from "@/lib/caisse/types";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const journee = await journeeOuverte();

  const supabase = await createClient();

  if (!journee) {
    const { data: derniere } = await supabase
      .schema("caisse")
      .from("clotures")
      .select("fond_laisse")
      .eq("type", "jour")
      .order("cree_le", { ascending: false })
      .limit(1)
      .maybeSingle<{ fond_laisse: number | null }>();
    return <OuvrirJournee fondPrecedent={derniere?.fond_laisse != null ? Number(derniere.fond_laisse) : null} />;
  }

  const [dossiers, apercu] = await Promise.all([
    supabase.schema("caisse").rpc("dossiers_prets"),
    supabase.schema("caisse").rpc("apercu_cloture"),
  ]);

  return (
    <EcranVente
      dossiers={(dossiers.data as DossierPret[] | null) ?? []}
      erreurDossiers={dossiers.error?.message ?? null}
      apercu={(apercu.data as ApercuJournee | null) ?? null}
    />
  );
}
