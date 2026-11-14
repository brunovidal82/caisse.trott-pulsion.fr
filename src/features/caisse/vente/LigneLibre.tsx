"use client";

import { useState } from "react";
import { lireMontant } from "@/lib/format";
import { TAUX_TVA, type LignePanier } from "@/lib/caisse/panier";
import { Modale } from "./Modale";

type Props = {
  onAjouter: (ligne: Omit<LignePanier, "cle">) => void;
  onFermer: () => void;
};

export function LigneLibre({ onAjouter, onFermer }: Props) {
  const [type, setType] = useState<"main_oeuvre" | "divers">("main_oeuvre");
  const [designation, setDesignation] = useState("Main d'œuvre");
  const [prix, setPrix] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [taux, setTaux] = useState<number>(20);
  const [erreur, setErreur] = useState<string | null>(null);

  function valider(e: React.FormEvent) {
    e.preventDefault();
    const montant = lireMontant(prix);
    const qte = Number(quantite.replace(",", "."));
    if (!designation.trim()) return setErreur("Indique une désignation.");
    if (montant === null) return setErreur("Prix invalide (ex. 25 ou 25,50).");
    if (!Number.isFinite(qte) || qte <= 0) return setErreur("Quantité invalide.");
    onAjouter({
      type,
      produitId: null,
      code: null,
      designation: designation.trim(),
      quantite: qte,
      prixUnitaireTtc: montant,
      remiseTtc: 0,
      tauxTva: taux,
      stock: null,
      origine: "manuel",
    });
  }

  return (
    <Modale titre="Ligne libre" onFermer={onFermer}>
      <form onSubmit={valider} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["main_oeuvre", "Main d'œuvre"],
              ["divers", "Divers"],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              onClick={() => {
                setType(valeur);
                if (valeur === "main_oeuvre" && !designation.trim()) setDesignation("Main d'œuvre");
              }}
              className={`h-11 rounded-xl border text-sm font-semibold ${
                type === valeur ? "border-2 border-[#0F172A] bg-slate-50" : "border-border"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Désignation
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="h-11 rounded-xl border border-border px-3 text-base"
            autoFocus
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-1 flex flex-col gap-1 text-sm font-medium">
            Prix TTC (€)
            <input
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              inputMode="decimal"
              placeholder="25,00"
              className="h-11 rounded-xl border border-border px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Quantité
            <input
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              inputMode="decimal"
              className="h-11 rounded-xl border border-border px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            TVA
            <select
              value={taux}
              onChange={(e) => setTaux(Number(e.target.value))}
              className="h-11 rounded-xl border border-border px-3 text-base"
            >
              {TAUX_TVA.map((t) => (
                <option key={t} value={t}>
                  {String(t).replace(".", ",")} %
                </option>
              ))}
            </select>
          </label>
        </div>
        {erreur ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>
        ) : null}
        <button type="submit" className="h-12 rounded-xl bg-[#0F172A] text-base font-semibold text-white">
          Ajouter au ticket
        </button>
      </form>
    </Modale>
  );
}
