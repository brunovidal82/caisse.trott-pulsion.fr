"use client";

import { Printer, Undo2, X } from "lucide-react";
import { useState } from "react";
import { numeroTicket } from "@/lib/caisse/panier";
import { euros } from "@/lib/format";
import { noterDuplicata, type TicketDetail } from "./actions";
import { FormulaireAnnulation } from "./FormulaireAnnulation";

const LIBELLE_MOYEN = { cb: "CB", especes: "Espèces", virement: "Virement", avoir: "Avoir" } as const;

type Props = {
  ticket: TicketDetail;
  onFermer: () => void;
  onAnnule: (ticketId: string) => Promise<void>;
};

function raisonBlocage(t: TicketDetail): string | null {
  if (t.type === "annulation") return "Un ticket d'annulation ne peut pas être annulé.";
  if (t.annule === "total") return "Ce ticket est déjà entièrement annulé.";
  if (t.type === "acompte" && t.acompteDeduit) return "Cet acompte a déjà été déduit d'une vente.";
  if (!t.journeeOuverte) return "Ouvre la journée pour pouvoir annuler.";
  return null;
}

export function DetailTicket({ ticket, onFermer, onAnnule }: Props) {
  const [annulation, setAnnulation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const blocage = raisonBlocage(ticket);

  async function duplicata() {
    setErreur(null);
    const r = await noterDuplicata(ticket.id);
    if (!r.ok) return setErreur(r.erreur);
    window.open(`/ticket/${ticket.id}?duplicata=${r.numero}&impression=1`, "ticket", "width=420,height=720");
  }

  return (
    <aside
      className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4"
      style={{ flex: "1 1 420px", maxWidth: 560, position: "sticky", top: 16 }}
    >
      <div className="flex items-center gap-2">
        <b className="font-mono text-lg">{numeroTicket(ticket.numero)}</b>
        <span className="text-sm text-muted-foreground">
          {new Date(ticket.creeLe).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {ticket.vendeur}
        </span>
        <button
          type="button"
          onClick={onFermer}
          className="ml-auto flex size-8 items-center justify-center rounded-lg hover:bg-muted"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>

      {ticket.clientNom ? <div className="text-sm">Client : {ticket.clientNom}</div> : null}
      {ticket.dossierId ? <div className="text-sm">Dossier atelier n°{ticket.dossierId}</div> : null}
      {ticket.type === "annulation" ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          Annulation de {ticket.origineNumero ? numeroTicket(ticket.origineNumero) : "?"} · motif : {ticket.motif}
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100 text-sm">
        {ticket.lignes.map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-3 py-2">
            <span>
              <b className="font-semibold">{l.designation}</b>
              <span className="block text-xs text-muted-foreground">
                {Math.abs(l.quantite)} × {euros(l.prixUnitaireTtc)}
                {l.remiseTtc !== 0 ? ` · remise ${euros(Math.abs(l.remiseTtc))}` : ""}
                {l.dejaQuantite > 0 ? ` · ${l.dejaQuantite} déjà annulé${l.dejaQuantite > 1 ? "s" : ""}` : ""}
              </span>
            </span>
            <b className="tabular-nums">{euros(l.totalTtc)}</b>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <b>Total TTC</b>
        <b className="text-lg tabular-nums">{euros(ticket.totalTtc)}</b>
      </div>
      <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
        {ticket.paiements.map((p, i) => (
          <span key={i} className="flex justify-between">
            <span>
              {p.montant < 0 ? "Remboursement " : ""}
              {LIBELLE_MOYEN[p.moyen]}
              {p.especesRecues !== null && p.rendu ? ` (reçu ${euros(p.especesRecues)}, rendu ${euros(p.rendu)})` : ""}
            </span>
            <span className="tabular-nums">{euros(p.montant)}</span>
          </span>
        ))}
      </div>

      {ticket.annulations.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {ticket.annulations.map((a) => (
            <div key={a.id}>
              Annulé par {numeroTicket(a.numero)} ({euros(a.totalTtc)}) · {a.motif}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={duplicata}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
        >
          <Printer className="size-4" />
          Duplicata
        </button>
        <button
          type="button"
          disabled={blocage !== null}
          onClick={() => setAnnulation(true)}
          title={blocage ?? undefined}
          style={{ backgroundColor: "#DC2626", color: "#FFFFFF", opacity: blocage ? 0.4 : 1 }}
          className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <Undo2 className="size-4" />
          Annuler…
        </button>
      </div>
      {blocage && ticket.type !== "annulation" ? <p className="text-xs text-muted-foreground">{blocage}</p> : null}
      {erreur ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p> : null}

      {annulation ? (
        <FormulaireAnnulation
          ticket={ticket}
          onFermer={() => setAnnulation(false)}
          onTermine={async () => {
            setAnnulation(false);
            await onAnnule(ticket.id);
          }}
        />
      ) : null}
    </aside>
  );
}
