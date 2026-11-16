"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { numeroTicket } from "@/lib/caisse/panier";
import { euros, heure } from "@/lib/format";
import { detailTicket, listerTickets, type TicketDetail, type TicketResume } from "./actions";
import { DetailTicket } from "./DetailTicket";

const LIBELLE_MOYEN = { cb: "CB", especes: "Espèces", virement: "Virement", avoir: "Avoir" } as const;

type Props = { initiaux: TicketResume[]; porteeInitiale: string };

function dateCourte(valeur: string) {
  const d = new Date(valeur);
  const jour = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" });
  return `${jour} ${heure(valeur)}`;
}

export function ListeTickets({ initiaux, porteeInitiale }: Props) {
  const [tickets, setTickets] = useState(initiaux);
  const [portee, setPortee] = useState(porteeInitiale);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<TicketDetail | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function chercher(saisie: string) {
    setChargement(true);
    setErreur(null);
    try {
      const r = await listerTickets(saisie);
      setTickets(r.tickets);
      setPortee(r.portee);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Recherche impossible.");
    } finally {
      setChargement(false);
    }
  }

  function saisir(valeur: string) {
    setRecherche(valeur);
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => chercher(valeur), 300);
  }

  async function ouvrir(id: string) {
    setErreur(null);
    try {
      setSelection(await detailTicket(id));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Ticket introuvable.");
    }
  }

  async function rafraichir(idAOuvrir: string) {
    await chercher(recherche);
    await ouvrir(idAOuvrir);
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section
        className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4"
        style={{ flex: "2 1 560px", minWidth: 0 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="h-9 rounded-lg border border-border px-3 text-sm leading-9 font-medium hover:bg-muted"
          >
            ← Retour à la vente
          </Link>
          <h2 className="text-lg font-bold">Tickets</h2>
          <span className="text-sm text-muted-foreground">{portee}</span>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-border px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Chercher un ticket</span>
          <input
            value={recherche}
            onChange={(e) => saisir(e.target.value)}
            placeholder="N° de ticket (15 ou T-0015), montant (34,90) ou nom du client"
            className="h-11 flex-1 bg-transparent outline-none"
            autoFocus
          />
        </label>
        {erreur ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p> : null}
        {chargement ? <p className="text-sm text-muted-foreground">Recherche…</p> : null}
        {tickets.length === 0 && !chargement ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun ticket.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => ouvrir(t.id)}
                  className="grid w-full items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50"
                  style={{
                    gridTemplateColumns: "auto 1fr auto",
                    backgroundColor: selection?.id === t.id ? "#F1F5F9" : undefined,
                  }}
                >
                  <b className="font-mono text-sm">{numeroTicket(t.numero)}</b>
                  <span className="truncate text-sm text-muted-foreground">
                    {dateCourte(t.creeLe)} · {t.vendeur}
                    {t.clientNom ? ` · ${t.clientNom}` : ""}
                  </span>
                  <b className={`text-right text-sm tabular-nums ${t.totalTtc < 0 ? "text-destructive" : ""}`}>
                    {euros(t.totalTtc)}
                  </b>
                  <span />
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    {t.type === "annulation" ? (
                      <Etiquette couleur="rouge">annulation de {t.origineNumero ? numeroTicket(t.origineNumero) : "?"}</Etiquette>
                    ) : null}
                    {t.type === "acompte" ? <Etiquette couleur="bleu">acompte</Etiquette> : null}
                    {t.annule === "total" ? <Etiquette couleur="rouge">annulé</Etiquette> : null}
                    {t.annule === "partiel" ? <Etiquette couleur="orange">annulé en partie</Etiquette> : null}
                    <span className="text-muted-foreground">{t.moyens.map((m) => LIBELLE_MOYEN[m]).join(" + ")}</span>
                  </span>
                  <span />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selection ? (
        <DetailTicket ticket={selection} onFermer={() => setSelection(null)} onAnnule={rafraichir} />
      ) : (
        <aside
          className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
          style={{ flex: "1 1 420px", maxWidth: 560 }}
        >
          Choisis un ticket pour le voir, le réimprimer ou l&apos;annuler.
        </aside>
      )}
    </div>
  );
}

function Etiquette({ couleur, children }: { couleur: "rouge" | "orange" | "bleu"; children: React.ReactNode }) {
  const styles = {
    rouge: "bg-red-50 text-red-700",
    orange: "bg-amber-50 text-amber-800",
    bleu: "bg-sky-50 text-sky-800",
  };
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${styles[couleur]}`}>{children}</span>;
}
