import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireCloture } from "@/features/caisse/cloture/FormulaireCloture";
import { journeeOuverte } from "@/lib/caisse/session";
import { euros, heure } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clôture",
};

type Apercu = {
  nb_tickets: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  detail_tva: { taux: number; ht: number; tva: number; ttc: number }[];
  detail_moyens: Partial<Record<"cb" | "especes" | "virement" | "avoir", number>>;
  fond_ouverture: number;
  especes_attendues: number;
};

const MOYENS = [
  ["cb", "CB"],
  ["especes", "Espèces (net)"],
  ["virement", "Virement"],
  ["avoir", "Avoirs (émis / utilisés)"],
] as const;

export default async function Page() {
  const journee = await journeeOuverte();
  if (!journee) redirect("/");

  const supabase = await createClient();
  const caisse = supabase.schema("caisse");
  const [{ data: apercuBrut, error }, { data: tickets }] = await Promise.all([
    caisse.rpc("apercu_cloture"),
    caisse
      .from("tickets")
      .select("type, total_ttc")
      .eq("journee_id", journee.id)
      .returns<{ type: "vente" | "annulation" | "acompte"; total_ttc: number }[]>(),
  ]);

  if (error || !apercuBrut) {
    return (
      <p className="mx-auto mt-10 max-w-xl rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error?.message ?? "Impossible de calculer la clôture."}
      </p>
    );
  }

  const apercu = apercuBrut as Apercu;
  const parType = (type: "vente" | "annulation" | "acompte") => {
    const liste = (tickets ?? []).filter((t) => t.type === type);
    return { nombre: liste.length, total: liste.reduce((s, t) => s + Number(t.total_ttc), 0) };
  };
  const ventes = parType("vente");
  const annulations = parType("annulation");
  const acomptes = parType("acompte");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="h-9 rounded-lg border border-border bg-white px-3 text-sm leading-9 font-medium hover:bg-muted"
        >
          ← Retour à la vente
        </Link>
        <h2 className="text-xl font-bold">Clôture de la journée n°{journee.numero}</h2>
        <span className="text-sm text-muted-foreground">
          ouverte à {heure(journee.ouverte_le)} par {journee.ouverte_par}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Chiffre titre="Ventes" valeur={String(ventes.nombre)} detail={euros(ventes.total)} />
        <Chiffre
          titre="Annulations"
          valeur={String(annulations.nombre)}
          detail={annulations.nombre ? euros(annulations.total) : "—"}
        />
        <Chiffre titre="Acomptes" valeur={String(acomptes.nombre)} detail={acomptes.nombre ? euros(acomptes.total) : "—"} />
        <Chiffre titre="Total TTC du jour" valeur={euros(apercu.total_ttc)} detail={`${apercu.nb_tickets} tickets`} fort />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-white p-4">
            <b className="text-sm">Par moyen de paiement</b>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              {MOYENS.map(([cle, libelle]) => (
                <span key={cle} className="contents">
                  <span className="text-muted-foreground">{libelle}</span>
                  <b className="text-right tabular-nums">{euros(apercu.detail_moyens[cle] ?? 0)}</b>
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-4">
            <b className="text-sm">Par taux de TVA</b>
            {apercu.detail_tva.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucune vente aujourd&apos;hui.</p>
            ) : (
              <table className="mt-2 w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Taux</th>
                    <th className="py-1 text-right font-medium">HT</th>
                    <th className="py-1 text-right font-medium">TVA</th>
                    <th className="py-1 text-right font-medium">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {apercu.detail_tva.map((t) => (
                    <tr key={t.taux} className="border-t border-slate-100">
                      <td className="py-1.5">{String(t.taux).replace(".", ",")} %</td>
                      <td className="py-1.5 text-right">{euros(t.ht)}</td>
                      <td className="py-1.5 text-right">{euros(t.tva)}</td>
                      <td className="py-1.5 text-right">{euros(t.ttc)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-bold">
                    <td className="py-1.5">Total</td>
                    <td className="py-1.5 text-right">{euros(apercu.total_ht)}</td>
                    <td className="py-1.5 text-right">{euros(apercu.total_tva)}</td>
                    <td className="py-1.5 text-right">{euros(apercu.total_ttc)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>
        </div>

        <FormulaireCloture
          fondOuverture={Number(apercu.fond_ouverture)}
          especesNettes={Number(apercu.detail_moyens.especes ?? 0)}
          attendues={Number(apercu.especes_attendues)}
        />
      </div>
    </div>
  );
}

function Chiffre({ titre, valeur, detail, fort = false }: { titre: string; valeur: string; detail: string; fort?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${fort ? "border-[#0F172A] bg-[#0F172A] text-white" : "border-border bg-white"}`}>
      <div className={`text-xs ${fort ? "text-slate-300" : "text-muted-foreground"}`}>{titre}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{valeur}</div>
      <div className={`text-sm tabular-nums ${fort ? "text-slate-300" : "text-muted-foreground"}`}>{detail}</div>
    </div>
  );
}
