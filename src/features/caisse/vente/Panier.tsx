"use client";

import { Minus, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { euros, lireMontant } from "@/lib/format";
import {
  enEuros,
  ttcLigneCentimes,
  type Acompte,
  type LignePanier,
  type Totaux,
} from "@/lib/caisse/panier";
import type { DossierPret } from "@/lib/caisse/types";
import type { Moyen } from "./Encaissement";
import { PhotoProduit } from "./PhotoProduit";

type Props = {
  lignes: LignePanier[];
  totaux: Totaux;
  acomptes: Acompte[];
  dossier: DossierPret | null;
  clientNom: string;
  onClientNom: (nom: string) => void;
  onModifier: (cle: string, changement: Partial<LignePanier>) => void;
  onRetirer: (cle: string) => void;
  onRetirerDossier: () => void;
  onVider: () => void;
  onEncaisser: (moyen: Moyen) => void;
  actionsSupplementaires?: React.ReactNode;
  actionsDroite?: React.ReactNode;
};

const MOYENS: { id: Moyen; libelle: string; detail?: string }[] = [
  { id: "cb", libelle: "CB", detail: "terminal" },
  { id: "especes", libelle: "Espèces", detail: "rendu calculé" },
  { id: "virement", libelle: "Virement" },
  { id: "avoir", libelle: "Avoir", detail: "AV-…" },
];

const LIBELLE_MOYEN: Record<Moyen, string> = {
  cb: "par CB",
  especes: "en espèces",
  virement: "par virement",
  avoir: "avec un avoir",
};

export function Panier({
  lignes,
  totaux,
  acomptes,
  dossier,
  clientNom,
  onClientNom,
  onModifier,
  onRetirer,
  onRetirerDossier,
  onVider,
  onEncaisser,
  actionsSupplementaires,
  actionsDroite,
}: Props) {
  const [moyen, setMoyen] = useState<Moyen>("cb");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const vide = lignes.length === 0;
  const negatif = totaux.aPayer < 0;

  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 xl:sticky xl:top-4">
      <div className="flex items-center gap-2">
        <b className="text-lg">Ticket</b>
        <span className="font-mono text-xs text-muted-foreground">en cours</span>
        {!vide ? (
          <button
            type="button"
            onClick={onVider}
            className="ml-auto h-8 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Vider
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Client</span>
        <input
          value={clientNom}
          onChange={(e) => onClientNom(e.target.value)}
          placeholder="Client de passage"
          className="h-9 flex-1 rounded-lg border border-border px-2"
        />
      </label>

      {dossier ? (
        <div className="flex items-start gap-2 rounded-xl bg-[#FFF7ED] px-3 py-2 text-sm text-[#7a2500]">
          <span className="flex-1">
            Dossier atelier n°{dossier.dossier_id} · {dossier.marque_modele ?? "—"} — passera en « Livré » à
            l&apos;encaissement
          </span>
          <button
            type="button"
            onClick={onRetirerDossier}
            className="flex size-6 items-center justify-center rounded-md hover:bg-white/60"
            aria-label="Retirer le dossier du ticket"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="max-h-[45dvh] overflow-y-auto">
        {vide ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Scanne un article, choisis un dossier atelier ou un rayon.
          </p>
        ) : (
          lignes.map((l) => (
            <LigneTicket
              key={l.cle}
              ligne={l}
              ouverte={ouverte === l.cle}
              onOuvrir={() => setOuverte(ouverte === l.cle ? null : l.cle)}
              onModifier={(c) => onModifier(l.cle, c)}
              onRetirer={() => {
                onRetirer(l.cle);
                setOuverte(null);
              }}
            />
          ))
        )}
        {acomptes.map((a) => (
          <div key={a.ticketId} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
            <span>Acompte ticket n°{a.numero}</span>
            <b className="tabular-nums text-[#9f360a]">−{euros(a.montant)}</b>
          </div>
        ))}
      </div>

      {actionsSupplementaires || actionsDroite ? (
        <div className="flex flex-wrap gap-2">
          {actionsSupplementaires}
          {actionsDroite}
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Total HT</span>
        <span className="text-right tabular-nums">{euros(totaux.ht)}</span>
        {totaux.parTaux.map((t) => (
          <span key={t.taux} className="contents">
            <span className="text-muted-foreground">TVA {String(t.taux).replace(".", ",")} %</span>
            <span className="text-right tabular-nums">{euros(t.tva)}</span>
          </span>
        ))}
        <b className="text-base">Total TTC</b>
        <b className="text-right text-base tabular-nums">{euros(totaux.ttc)}</b>
        {totaux.acomptes > 0 ? (
          <>
            <span className="text-muted-foreground">Acomptes déjà versés</span>
            <span className="text-right tabular-nums">−{euros(totaux.acomptes)}</span>
            <b className="text-lg">À payer</b>
            <b className="text-right text-lg tabular-nums">{euros(totaux.aPayer)}</b>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MOYENS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMoyen(m.id)}
            className={`flex h-14 flex-col items-center justify-center rounded-xl border text-sm font-semibold ${
              moyen === m.id ? "border-2 border-[#0F172A] bg-slate-50" : "border-border bg-white"
            }`}
          >
            {m.libelle}
            {m.detail ? <small className="text-[11px] font-medium text-muted-foreground">{m.detail}</small> : null}
          </button>
        ))}
      </div>

      {negatif ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Les acomptes dépassent le total : ajoute les lignes manquantes du dossier.
        </p>
      ) : null}

      <button
        type="button"
        disabled={vide || negatif}
        onClick={() => onEncaisser(moyen)}
        className="h-16 rounded-xl bg-[#0F172A] text-lg font-bold text-white disabled:opacity-40"
      >
        Encaisser {euros(Math.max(totaux.aPayer, 0))} {LIBELLE_MOYEN[moyen]}
      </button>
    </aside>
  );
}

function LigneTicket({
  ligne,
  ouverte,
  onOuvrir,
  onModifier,
  onRetirer,
}: {
  ligne: LignePanier;
  ouverte: boolean;
  onOuvrir: () => void;
  onModifier: (changement: Partial<LignePanier>) => void;
  onRetirer: () => void;
}) {
  const total = enEuros(ttcLigneCentimes(ligne));
  const pas = Number.isInteger(ligne.quantite) ? 1 : 0.1;

  return (
    <div className="border-b border-slate-100 py-2.5">
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: "auto 1fr auto 80px" }}>
        <PhotoProduit photo={ligne.photo} categorie={ligne.categorie} designation={ligne.designation} taille={36} />
        <button type="button" onClick={onOuvrir} className="min-w-0 text-left">
          <b className="block truncate text-sm font-semibold">{ligne.designation}</b>
          <span className="block truncate text-xs text-muted-foreground">
            {euros(ligne.prixUnitaireTtc)}
            {ligne.remiseTtc > 0 ? ` · remise −${euros(ligne.remiseTtc)}` : ""}
            {ligne.origine === "dossier" ? " · dossier" : ""}
            {ligne.stock !== null ? ` · stock ${ligne.stock} → ${ligne.stock - ligne.quantite}` : ""}
            {ligne.type === "main_oeuvre" ? " · main d'œuvre" : ""}
          </span>
        </button>
        <div className="inline-flex h-9 items-center rounded-lg border border-border">
          <button
            type="button"
            onClick={() =>
              ligne.quantite - pas <= 0 ? onRetirer() : onModifier({ quantite: +(ligne.quantite - pas).toFixed(3) })
            }
            className="flex h-full w-8 items-center justify-center text-slate-600"
            aria-label="Moins"
          >
            <Minus className="size-4" />
          </button>
          <b className="w-8 text-center text-sm tabular-nums">{ligne.quantite}</b>
          <button
            type="button"
            onClick={() => onModifier({ quantite: +(ligne.quantite + pas).toFixed(3) })}
            className="flex h-full w-8 items-center justify-center text-slate-600"
            aria-label="Plus"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <b className="text-right text-sm tabular-nums">{euros(total)}</b>
      </div>

      {ouverte ? (
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl bg-slate-50 p-2">
          <ChampMontant
            libelle="Prix unitaire TTC"
            valeur={ligne.prixUnitaireTtc}
            onValider={(v) => onModifier({ prixUnitaireTtc: v })}
          />
          <ChampMontant
            libelle="Remise (€)"
            valeur={ligne.remiseTtc}
            onValider={(v) => {
              const max = enEuros(ttcLigneCentimes({ ...ligne, remiseTtc: 0 }));
              onModifier({ remiseTtc: Math.min(v, max) });
            }}
          />
          <button
            type="button"
            onClick={onRetirer}
            className="flex h-9 items-center gap-1 rounded-lg border border-border bg-white px-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
            Retirer
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ChampMontant({
  libelle,
  valeur,
  onValider,
}: {
  libelle: string;
  valeur: number;
  onValider: (valeur: number) => void;
}) {
  const [saisie, setSaisie] = useState(valeur.toFixed(2).replace(".", ","));

  function appliquer() {
    const montant = lireMontant(saisie);
    if (montant === null) {
      setSaisie(valeur.toFixed(2).replace(".", ","));
      return;
    }
    onValider(montant);
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {libelle}
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onBlur={appliquer}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            appliquer();
          }
        }}
        inputMode="decimal"
        className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-foreground tabular-nums"
      />
    </label>
  );
}
