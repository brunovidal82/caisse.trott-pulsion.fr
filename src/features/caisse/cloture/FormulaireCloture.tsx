"use client";

import { AlertTriangle } from "lucide-react";
import { useActionState, useState } from "react";
import { ecartCaisse, remiseEnBanque } from "@/lib/caisse/cloture";
import { euros, lireMontant } from "@/lib/format";
import { cloturerJournee, type EtatCloture } from "./actions";

type Props = {
  fondOuverture: number;
  especesNettes: number;
  attendues: number;
};

function enSaisie(montant: number) {
  return montant.toFixed(2).replace(".", ",");
}

export function FormulaireCloture({ fondOuverture, especesNettes, attendues }: Props) {
  const [etat, action, enCours] = useActionState<EtatCloture, FormData>(cloturerJournee, {});
  const [comptees, setComptees] = useState("");
  const [fond, setFond] = useState(enSaisie(fondOuverture));
  const [ecartConfirme, setEcartConfirme] = useState(false);

  const compteesSaisies = lireMontant(comptees);
  const fondSaisi = lireMontant(fond);
  const ecart = compteesSaisies !== null ? ecartCaisse(attendues, compteesSaisies) : null;
  const remise = compteesSaisies !== null && fondSaisi !== null ? remiseEnBanque(compteesSaisies, fondSaisi) : null;
  const ecartNonNul = ecart !== null && ecart !== 0;
  const doitConfirmer = ecartNonNul;

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5">
      <input type="hidden" name="attendues" value={attendues} />
      <input type="hidden" name="ecart_confirme" value={ecartConfirme ? "1" : "0"} />

      <div className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <span className="text-muted-foreground">Fond de caisse du matin</span>
        <span className="text-right tabular-nums">{euros(fondOuverture)}</span>
        <span className="text-muted-foreground">Espèces encaissées (net des rendus et remboursements)</span>
        <span className="text-right tabular-nums">{euros(especesNettes)}</span>
        <b>Espèces attendues dans la caisse</b>
        <b className="text-right text-base tabular-nums">{euros(attendues)}</b>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Espèces comptées
        <input
          name="comptees"
          value={comptees}
          onChange={(e) => {
            setComptees(e.target.value);
            setEcartConfirme(false);
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder={enSaisie(attendues)}
          className="h-12 rounded-xl border border-border px-3 text-lg tabular-nums"
          autoFocus
          required
        />
      </label>

      {ecart !== null ? (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 ${
            ecartNonNul ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
          }`}
        >
          <span className="font-medium">{ecartNonNul ? "Écart" : "Caisse juste"}</span>
          <b className="text-2xl tabular-nums">
            {ecart > 0 ? "+" : ""}
            {euros(ecart)}
          </b>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Fond laissé pour demain
          <input
            name="fond"
            value={fond}
            onChange={(e) => setFond(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="h-11 rounded-xl border border-border px-3 text-base tabular-nums"
            required
          />
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Remis en banque
          <div className="flex h-11 items-center rounded-xl bg-slate-50 px-3 text-base font-bold tabular-nums">
            {remise !== null ? euros(remise) : "—"}
          </div>
        </div>
      </div>

      {doitConfirmer ? (
        <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={ecartConfirme}
            onChange={(e) => setEcartConfirme(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span className="flex gap-1.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            J&apos;ai recompté : l&apos;écart de {euros(ecart ?? 0)} sera enregistré sur la clôture.
          </span>
        </label>
      ) : null}

      {etat.erreur ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{etat.erreur}</p>
      ) : null}

      <button
        type="submit"
        disabled={enCours || compteesSaisies === null || (doitConfirmer && !ecartConfirme)}
        className="h-14 rounded-xl bg-[#0F172A] text-base font-semibold text-white disabled:opacity-40"
      >
        {enCours ? "Clôture…" : "Clôturer et imprimer le ticket Z"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Après la clôture, plus aucune vente ne peut être ajoutée à cette journée.
      </p>
    </form>
  );
}
