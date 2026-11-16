import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImpressionAuto } from "@/features/caisse/ticket/ImpressionAuto";
import { BOUTIQUE } from "@/lib/caisse/boutique";
import { numeroTicket } from "@/lib/caisse/panier";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ticket",
};

type Ticket = {
  id: string;
  numero: number;
  type: "vente" | "annulation" | "acompte";
  motif: string | null;
  client_nom: string | null;
  dossier_id: number | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  mode_test: boolean;
  cree_le: string;
  ticket_origine_id: string | null;
  vendeurs: { prenom: string } | { prenom: string }[] | null;
};

type Ligne = {
  ordre: number;
  type: string;
  designation: string;
  quantite: number;
  prix_unitaire_ttc: number;
  remise_ttc: number;
  taux_tva: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
};

type PaiementTicket = {
  moyen: "cb" | "especes" | "virement" | "avoir";
  montant: number;
  especes_recues: number | null;
  rendu: number | null;
  avoir_id: string | null;
};

const MOYENS: Record<PaiementTicket["moyen"], string> = {
  cb: "CB",
  especes: "Espèces",
  virement: "Virement",
  avoir: "Avoir",
};

const TITRES: Record<Ticket["type"], string> = {
  vente: "Ticket",
  annulation: "Annulation",
  acompte: "Acompte",
};

function nombre(valeur: number | string) {
  return Number(valeur).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quantite(valeur: number | string) {
  return Number(valeur).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicata?: string }>;
}) {
  const { id } = await params;
  const { duplicata } = await searchParams;
  const numeroDuplicata = duplicata && /^\d+$/.test(duplicata) ? Number(duplicata) : null;
  const supabase = await createClient();
  const caisse = supabase.schema("caisse");

  const { data: ticket } = await caisse
    .from("tickets")
    .select(
      "id, numero, type, motif, client_nom, dossier_id, total_ht, total_tva, total_ttc, mode_test, cree_le, ticket_origine_id, vendeurs(prenom)",
    )
    .eq("id", id)
    .maybeSingle<Ticket>();

  if (!ticket) notFound();

  const [{ data: lignes }, { data: paiements }, { data: origine }] = await Promise.all([
    caisse
      .from("lignes")
      .select("ordre, type, designation, quantite, prix_unitaire_ttc, remise_ttc, taux_tva, total_ht, total_tva, total_ttc")
      .eq("ticket_id", id)
      .order("ordre")
      .returns<Ligne[]>(),
    caisse
      .from("paiements")
      .select("moyen, montant, especes_recues, rendu, avoir_id")
      .eq("ticket_id", id)
      .returns<PaiementTicket[]>(),
    ticket.ticket_origine_id
      ? caisse.from("tickets").select("numero").eq("id", ticket.ticket_origine_id).maybeSingle<{ numero: number }>()
      : Promise.resolve({ data: null }),
  ]);

  const avoirIds = (paiements ?? []).map((p) => p.avoir_id).filter((v): v is string => Boolean(v));
  const { data: avoirs } = avoirIds.length
    ? await caisse
        .from("avoirs")
        .select("id, numero, expire_le, emis_par_ticket_id")
        .in("id", avoirIds)
        .returns<{ id: string; numero: string; expire_le: string; emis_par_ticket_id: string }[]>()
    : { data: [] as { id: string; numero: string; expire_le: string; emis_par_ticket_id: string }[] };
  const avoirParId = new Map((avoirs ?? []).map((a) => [a.id, a]));

  const vendeur = Array.isArray(ticket.vendeurs) ? ticket.vendeurs[0] : ticket.vendeurs;
  const date = new Date(ticket.cree_le).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parTaux = new Map<number, { ht: number; tva: number }>();
  for (const l of lignes ?? []) {
    const taux = Number(l.taux_tva);
    const cumul = parTaux.get(taux) ?? { ht: 0, tva: 0 };
    parTaux.set(taux, { ht: cumul.ht + Number(l.total_ht), tva: cumul.tva + Number(l.total_tva) });
  }
  const rendu = (paiements ?? []).reduce((s, p) => s + Number(p.rendu ?? 0), 0);

  return (
    <div className="ticket-page min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
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
      <div className="ticket mx-auto w-[72mm] bg-white p-[3mm] font-mono text-[11.5px] leading-snug text-black shadow-md">
        <div className="text-center">
          <b className="text-[14px]">{BOUTIQUE.enseigne}</b>
          {BOUTIQUE.lignes.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        {numeroDuplicata ? (
          <div className="my-2 border-2 border-black py-1 text-center text-[13px] font-bold">
            DUPLICATA N°{numeroDuplicata}
          </div>
        ) : null}
        {ticket.mode_test ? (
          <div className="my-2 border border-black py-1 text-center font-bold">
            MODE TEST
            <div className="font-normal">ticket sans valeur fiscale</div>
          </div>
        ) : null}
        <hr className="my-2 border-dashed border-black" />
        <div className="flex justify-between">
          <span>
            {TITRES[ticket.type]} {numeroTicket(ticket.numero)}
          </span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>{BOUTIQUE.caisse}</span>
          <span>Vendeur : {vendeur?.prenom ?? "—"}</span>
        </div>
        {ticket.client_nom ? <div>Client : {ticket.client_nom}</div> : null}
        {ticket.dossier_id ? <div>Dossier atelier n°{ticket.dossier_id}</div> : null}
        {ticket.type === "acompte" ? <div>Acompte à déduire de la facture finale du dossier</div> : null}
        {origine ? <div>Annule le ticket {numeroTicket(origine.numero)}</div> : null}
        {ticket.motif ? <div>Motif : {ticket.motif}</div> : null}
        <hr className="my-2 border-dashed border-black" />
        {(lignes ?? []).map((l) => (
          <div key={l.ordre} className="mb-1">
            <div>{l.designation}</div>
            <div className="flex justify-between">
              <span>
                &nbsp;{quantite(l.quantite)} x {nombre(l.prix_unitaire_ttc)}
                {Number(l.remise_ttc) !== 0 ? ` remise -${nombre(Math.abs(Number(l.remise_ttc)))}` : ""}
              </span>
              <span>{nombre(l.total_ttc)}</span>
            </div>
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        <div className="flex justify-between text-[13px] font-bold">
          <span>TOTAL TTC</span>
          <span>{nombre(ticket.total_ttc)} €</span>
        </div>
        {[...parTaux.entries()]
          .sort(([a], [b]) => b - a)
          .map(([taux, v]) => (
            <div key={taux} className="flex justify-between">
              <span>dont TVA {String(taux).replace(".", ",")} %</span>
              <span>{nombre(v.tva)}</span>
            </div>
          ))}
        <div className="flex justify-between">
          <span>Total HT</span>
          <span>{nombre(ticket.total_ht)}</span>
        </div>
        <hr className="my-2 border-dashed border-black" />
        {(paiements ?? []).map((p, i) => {
          const avoir = p.avoir_id ? avoirParId.get(p.avoir_id) : undefined;
          return (
            <div key={i}>
              <div className="flex justify-between">
                <span>
                  {Number(p.montant) < 0 ? "Remboursement " : ""}
                  {MOYENS[p.moyen]}
                  {avoir ? ` ${avoir.numero}` : ""}
                </span>
                <span>{nombre(p.especes_recues ?? p.montant)}</span>
              </div>
              {avoir && avoir.emis_par_ticket_id === ticket.id ? (
                <div>
                  Avoir valable jusqu&apos;au {new Date(avoir.expire_le).toLocaleDateString("fr-FR")}, utilisable
                  en une seule fois
                </div>
              ) : null}
            </div>
          );
        })}
        {rendu > 0 ? (
          <div className="flex justify-between">
            <span>Rendu</span>
            <span>{nombre(rendu)}</span>
          </div>
        ) : null}
        <hr className="my-2 border-dashed border-black" />
        <div className="text-center">
          {ticket.mode_test ? "Non signé (mode test)" : "Signature fiskaltrust à venir"}
        </div>
        <div className="mt-1 text-center">{BOUTIQUE.merci}</div>
      </div>
    </div>
  );
}
