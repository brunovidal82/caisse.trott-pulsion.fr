"use client";

import { CheckCircle2, Minus, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { MOTIFS, montantAnnule, resteAnnulable, totalRembourse } from "@/lib/caisse/annulation";
import { numeroTicket } from "@/lib/caisse/panier";
import { euros } from "@/lib/format";
import { Modale } from "@/features/caisse/vente/Modale";
import { annulerTicket, type ResultatAnnulation, type TicketDetail } from "./actions";

type Remboursement = "cb" | "especes" | "avoir";

const REMBOURSEMENTS: { id: Remboursement; libelle: string }[] = [
  { id: "cb", libelle: "CB" },
  { id: "especes", libelle: "Espèces" },
  { id: "avoir", libelle: "Avoir client" },
];

type Props = {
  ticket: TicketDetail;
  onFermer: () => void;
  onTermine: () => Promise<void>;
};

function remboursementParDefaut(ticket: TicketDetail): Remboursement {
  const principal = [...ticket.paiements].sort((a, b) => b.montant - a.montant)[0]?.moyen;
  if (principal === "cb" || principal === "especes" || principal === "avoir") return principal;
  return "avoir";
}

export function FormulaireAnnulation({ ticket, onFermer, onTermine }: Props) {
  const annulables = ticket.lignes.filter((l) => resteAnnulable(l) > 0);
  const toutAnnulable = ticket.type === "acompte";
  const [quantites, setQuantites] = useState<Record<string, number>>(
    Object.fromEntries(annulables.map((l) => [l.id, resteAnnulable(l)])),
  );
  const [motif, setMotif] = useState<string>(MOTIFS[0]);
  const [autreMotif, setAutreMotif] = useState("");
  const [remboursement, setRemboursement] = useState<Remboursement>(remboursementParDefaut(ticket));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Extract<ResultatAnnulation, { ok: true }> | null>(null);

  const total = totalRembourse(annulables, quantites);
  const tout = annulables.every((l) => (quantites[l.id] ?? 0) >= resteAnnulable(l));
  const motifFinal = motif === "Autre" ? autreMotif.trim() : motif;

  function changer(id: string, delta: number, max: number) {
    setQuantites((q) => ({ ...q, [id]: Math.min(max, Math.max(0, Math.round(((q[id] ?? 0) + delta) * 1000) / 1000)) }));
  }

  async function valider() {
    if (!motifFinal) return setErreur("Indique le motif.");
    if (total <= 0) return setErreur("Choisis au moins un article à annuler.");
    setEnCours(true);
    setErreur(null);
    const r = await annulerTicket({
      ticketId: ticket.id,
      motif: motifFinal,
      remboursement,
      lignes: tout
        ? null
        : annulables
            .filter((l) => (quantites[l.id] ?? 0) > 0)
            .map((l) => ({ ligneId: l.id, quantite: quantites[l.id] })),
    });
    setEnCours(false);
    if (!r.ok) return setErreur(r.erreur);
    setResultat(r);
  }

  if (resultat) {
    const montant = Math.abs(resultat.totalTtc);
    return (
      <Modale titre="Annulation enregistrée">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <div>
            <b className="text-lg">{numeroTicket(resultat.numero)}</b>
            <div className="text-sm text-muted-foreground">
              annule {numeroTicket(ticket.numero)} · {euros(-montant)}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          {resultat.remboursement === "cb" ? (
            <>Fais le remboursement de <b>{euros(montant)}</b> sur le terminal CB.</>
          ) : resultat.remboursement === "especes" ? (
            <>
              Rends <b className="text-lg">{euros(montant)}</b> en espèces au client.
            </>
          ) : (
            <>
              Avoir <b>{resultat.avoirNumero}</b> de <b>{euros(montant)}</b>, valable jusqu&apos;au{" "}
              {resultat.avoirExpireLe ? new Date(resultat.avoirExpireLe).toLocaleDateString("fr-FR") : "?"}, utilisable
              en une seule fois. Il est imprimé sur le ticket.
            </>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() =>
              window.open(`/ticket/${resultat.ticketId}?impression=1`, "ticket", "width=420,height=720")
            }
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0F172A] text-base font-semibold text-white"
          >
            <Printer className="size-5" />
            Imprimer le ticket d&apos;annulation
          </button>
          <button
            type="button"
            onClick={onTermine}
            className="h-12 rounded-xl border border-border text-base font-semibold hover:bg-muted"
          >
            Terminé
          </button>
        </div>
      </Modale>
    );
  }

  return (
    <Modale titre={`Annuler ${numeroTicket(ticket.numero)}`} onFermer={enCours ? undefined : onFermer} largeur="max-w-xl">
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-sm font-medium">Articles à annuler</span>
          <ul className="mt-1 divide-y divide-slate-100 rounded-xl border border-border">
            {annulables.map((l) => {
              const reste = resteAnnulable(l);
              const q = quantites[l.id] ?? 0;
              const pas = Number.isInteger(reste) ? 1 : reste;
              return (
                <li key={l.id} className="grid items-center gap-3 px-3 py-2 text-sm" style={{ gridTemplateColumns: "1fr auto 80px" }}>
                  <span>
                    <b className="font-semibold">{l.designation}</b>
                    <span className="block text-xs text-muted-foreground">
                      {reste} à annuler sur {l.quantite}
                    </span>
                  </span>
                  {toutAnnulable ? (
                    <span className="text-sm">{q}</span>
                  ) : (
                    <span className="inline-flex h-9 items-center rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => changer(l.id, -pas, reste)}
                        className="flex h-full w-8 items-center justify-center"
                        aria-label="Moins"
                      >
                        <Minus className="size-4" />
                      </button>
                      <b className="w-8 text-center tabular-nums">{q}</b>
                      <button
                        type="button"
                        onClick={() => changer(l.id, pas, reste)}
                        className="flex h-full w-8 items-center justify-center"
                        aria-label="Plus"
                      >
                        <Plus className="size-4" />
                      </button>
                    </span>
                  )}
                  <b className="text-right tabular-nums">{euros(-montantAnnule(l, q))}</b>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <span className="text-sm font-medium">Motif (obligatoire)</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {[...MOTIFS, "Autre"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotif(m)}
                className={`h-9 rounded-full border px-3.5 text-sm font-medium ${
                  motif === m ? "border-[#0F172A] bg-[#0F172A] text-white" : "border-border bg-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {motif === "Autre" ? (
            <input
              value={autreMotif}
              onChange={(e) => setAutreMotif(e.target.value)}
              placeholder="Précise le motif"
              className="mt-2 h-10 w-full rounded-xl border border-border px-3"
              autoFocus
            />
          ) : null}
        </div>

        <div>
          <span className="text-sm font-medium">Remboursement</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {REMBOURSEMENTS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRemboursement(r.id)}
                className={`h-11 rounded-xl border text-sm font-semibold ${
                  remboursement === r.id ? "border-2 border-[#0F172A] bg-slate-50" : "border-border"
                }`}
              >
                {r.libelle}
              </button>
            ))}
          </div>
          {remboursement === "avoir" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Avoir AV-… valable 6 mois, utilisable en une seule fois.
            </p>
          ) : null}
        </div>

        {ticket.facture ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Ce ticket a une facture ({ticket.facture.numero ?? "—"}). Pense à faire l&apos;avoir correspondant sur la
            facture dans FormulaireDB.
          </p>
        ) : null}
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
          Crée un ticket d&apos;annulation de <b>{euros(-total)}</b> lié à {numeroTicket(ticket.numero)}. Le stock des
          articles est remis. Rien n&apos;est effacé.
        </p>

        {erreur ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p> : null}

        <button
          type="button"
          disabled={enCours || total <= 0 || !motifFinal}
          onClick={valider}
          style={{
            backgroundColor: "#DC2626",
            color: "#FFFFFF",
            opacity: enCours || total <= 0 || !motifFinal ? 0.4 : 1,
          }}
          className="h-14 rounded-xl text-base font-semibold"
        >
          {enCours ? "Annulation…" : `Annuler et rembourser ${euros(total)}`}
        </button>
      </div>
    </Modale>
  );
}
