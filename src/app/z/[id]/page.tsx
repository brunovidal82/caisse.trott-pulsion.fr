import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImpressionAuto } from "@/features/caisse/ticket/ImpressionAuto";
import { BOUTIQUE } from "@/lib/caisse/boutique";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ticket Z",
};

type Cloture = {
  id: string;
  type: "jour" | "mois" | "an";
  periode: string;
  journee_id: string | null;
  nb_tickets: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  detail_tva: { taux: number; ht: number; tva: number; ttc: number }[];
  detail_moyens: Partial<Record<"cb" | "especes" | "virement" | "avoir", number>>;
  grand_total_perpetuel: number;
  especes_attendues: number | null;
  especes_comptees: number | null;
  ecart: number | null;
  fond_laisse: number | null;
  remise_banque: number | null;
  cree_le: string;
  cree_par: string;
};

const MOYENS = [
  ["cb", "CB"],
  ["especes", "Espèces"],
  ["virement", "Virement"],
  ["avoir", "Avoirs"],
] as const;

function nombre(valeur: number | string | null | undefined) {
  return Number(valeur ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateHeure(valeur: string) {
  return new Date(valeur).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Ligne({ libelle, valeur, fort = false }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`flex justify-between ${fort ? "font-bold" : ""}`}>
      <span>{libelle}</span>
      <span>{valeur}</span>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const caisse = supabase.schema("caisse");

  const { data: cloture } = await caisse.from("clotures").select("*").eq("id", id).maybeSingle<Cloture>();
  if (!cloture) notFound();

  const [{ data: journee }, { data: auteur }, { data: tickets }] = await Promise.all([
    cloture.journee_id
      ? caisse
          .from("journees")
          .select("numero, ouverte_le, fond_ouverture, ouverte_par")
          .eq("id", cloture.journee_id)
          .maybeSingle<{ numero: number; ouverte_le: string; fond_ouverture: number; ouverte_par: string }>()
      : Promise.resolve({ data: null }),
    caisse.from("vendeurs").select("prenom").eq("id", cloture.cree_par).maybeSingle<{ prenom: string }>(),
    cloture.journee_id
      ? caisse
          .from("tickets")
          .select("type, total_ttc, mode_test")
          .eq("journee_id", cloture.journee_id)
          .returns<{ type: string; total_ttc: number; mode_test: boolean }[]>()
      : Promise.resolve({ data: [] as { type: string; total_ttc: number; mode_test: boolean }[] }),
  ]);

  const compte = (type: string) => {
    const liste = (tickets ?? []).filter((t) => t.type === type);
    return `${liste.length} · ${nombre(liste.reduce((s, t) => s + Number(t.total_ttc), 0))}`;
  };
  const modeTest = (tickets ?? []).length === 0 || (tickets ?? []).some((t) => t.mode_test);
  const titre =
    cloture.type === "jour" ? "TICKET Z · CLÔTURE DU JOUR" : cloture.type === "mois" ? "CLÔTURE MENSUELLE" : "CLÔTURE ANNUELLE";

  return (
    <div className="min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          body { background: #fff; }
          .ticket-actions { display: none !important; }
          .ticket { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
      <Suspense fallback={null}>
        <ImpressionAuto />
      </Suspense>
      <div className="ticket-actions mx-auto mb-4 flex w-[72mm] justify-center">
        <Link href="/" className="text-sm font-medium text-slate-700 underline underline-offset-4">
          Retour à la caisse
        </Link>
      </div>
      <div className="ticket mx-auto w-[72mm] bg-white p-[3mm] font-mono text-[11.5px] leading-snug text-black shadow-md">
        <div className="text-center">
          <b className="text-[14px]">{BOUTIQUE.enseigne}</b>
          {BOUTIQUE.lignes.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        {modeTest ? (
          <div className="my-2 border border-black py-1 text-center font-bold">
            MODE TEST
            <div className="font-normal">sans valeur fiscale</div>
          </div>
        ) : null}
        <hr className="my-2 border-dashed border-black" />
        <div className="text-center font-bold">{titre}</div>
        <Ligne libelle="Période" valeur={cloture.periode} />
        {journee ? (
          <>
            <Ligne libelle="Journée" valeur={`n°${journee.numero}`} />
            <Ligne libelle="Ouverte le" valeur={dateHeure(journee.ouverte_le)} />
          </>
        ) : null}
        <Ligne libelle="Clôturée le" valeur={dateHeure(cloture.cree_le)} />
        <Ligne libelle={BOUTIQUE.caisse} valeur={`par ${auteur?.prenom ?? "—"}`} />
        <hr className="my-2 border-dashed border-black" />
        <Ligne libelle="Nombre de tickets" valeur={String(cloture.nb_tickets)} />
        {cloture.type === "jour" ? (
          <>
            <Ligne libelle="Ventes" valeur={compte("vente")} />
            <Ligne libelle="Annulations" valeur={compte("annulation")} />
            <Ligne libelle="Acomptes" valeur={compte("acompte")} />
          </>
        ) : null}
        <hr className="my-2 border-dashed border-black" />
        {(cloture.detail_tva ?? []).map((t) => (
          <div key={t.taux}>
            <div>TVA {String(t.taux).replace(".", ",")} %</div>
            <Ligne libelle="  HT / TVA" valeur={`${nombre(t.ht)} / ${nombre(t.tva)}`} />
          </div>
        ))}
        <Ligne libelle="Total HT" valeur={nombre(cloture.total_ht)} />
        <Ligne libelle="Total TVA" valeur={nombre(cloture.total_tva)} />
        <Ligne libelle="TOTAL TTC" valeur={`${nombre(cloture.total_ttc)} €`} fort />
        <hr className="my-2 border-dashed border-black" />
        {MOYENS.map(([cle, libelle]) =>
          cloture.detail_moyens?.[cle] !== undefined ? (
            <Ligne key={cle} libelle={libelle} valeur={nombre(cloture.detail_moyens[cle])} />
          ) : null,
        )}
        {cloture.type === "jour" ? (
          <>
            <hr className="my-2 border-dashed border-black" />
            <Ligne libelle="Fond du matin" valeur={nombre(journee?.fond_ouverture)} />
            <Ligne libelle="Espèces attendues" valeur={nombre(cloture.especes_attendues)} />
            <Ligne libelle="Espèces comptées" valeur={nombre(cloture.especes_comptees)} />
            <Ligne
              libelle="Écart"
              valeur={`${Number(cloture.ecart ?? 0) > 0 ? "+" : ""}${nombre(cloture.ecart)}`}
              fort={Number(cloture.ecart ?? 0) !== 0}
            />
            <Ligne libelle="Fond laissé" valeur={nombre(cloture.fond_laisse)} />
            <Ligne libelle="Remis en banque" valeur={nombre(cloture.remise_banque)} />
          </>
        ) : null}
        <hr className="my-2 border-dashed border-black" />
        <Ligne libelle="Grand total perpétuel" valeur={nombre(cloture.grand_total_perpetuel)} />
        <div className="mt-2 text-center">{modeTest ? "Non signé (mode test)" : "Signature fiskaltrust à venir"}</div>
      </div>
    </div>
  );
}
