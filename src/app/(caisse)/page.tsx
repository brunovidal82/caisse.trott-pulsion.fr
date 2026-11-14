import { OuvrirJournee } from "@/features/caisse/OuvrirJournee";
import { EcranVente } from "@/features/caisse/vente/EcranVente";
import { journeeOuverte } from "@/lib/caisse/session";
import type { ApercuJournee, DossierPret } from "@/lib/caisse/types";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const journee = await journeeOuverte();

  if (!journee) {
    return <OuvrirJournee />;
  }

  const supabase = await createClient();
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
