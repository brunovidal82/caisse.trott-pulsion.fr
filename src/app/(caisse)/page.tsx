import { OuvrirJournee } from "@/features/caisse/OuvrirJournee";
import { journeeOuverte } from "@/lib/caisse/session";
import { euros } from "@/lib/format";

export default async function Page() {
  const journee = await journeeOuverte();

  if (!journee) {
    return <OuvrirJournee />;
  }

  return (
    <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-white p-8 text-center">
      <h2 className="text-lg font-bold">Journée n°{journee.numero} ouverte</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ouverte par {journee.ouverte_par} · {journee.nb_tickets} ticket
        {journee.nb_tickets > 1 ? "s" : ""} · {euros(journee.total_ttc)}
      </p>
      <p className="mt-6 rounded-lg bg-[#FFF8C5] px-4 py-3 text-sm text-[#5C4A00]">
        L&apos;écran de vente arrive à la prochaine étape.
      </p>
    </section>
  );
}
