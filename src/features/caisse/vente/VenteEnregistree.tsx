"use client";

import { CheckCircle2, Printer } from "lucide-react";
import { useEffect } from "react";
import { euros } from "@/lib/format";
import { numeroTicket, renduMonnaie, type Paiement } from "@/lib/caisse/panier";
import type { ResultatVente } from "./actions";
import { Modale } from "./Modale";

const LIBELLES: Record<Paiement["moyen"], string> = {
  cb: "CB",
  especes: "espèces",
  virement: "virement",
  avoir: "avoir",
};

type Props = {
  resultat: Extract<ResultatVente, { ok: true }>;
  paiements: Paiement[];
  onNouvelleVente: () => void;
};

export function VenteEnregistree({ resultat, paiements, onNouvelleVente }: Props) {
  const rendu = renduMonnaie(paiements);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.target as HTMLElement | null)?.tagName !== "BUTTON") onNouvelleVente();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onNouvelleVente]);

  function imprimer() {
    window.open(`/ticket/${resultat.ticketId}?impression=1`, "ticket", "width=420,height=720");
  }

  return (
    <Modale titre="Vente enregistrée">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <div>
          <b className="text-lg">Vente n° {numeroTicket(resultat.numero)}</b>
          <div className="text-sm text-muted-foreground">
            {euros(resultat.totalTtc)} · {paiements.map((p) => LIBELLES[p.moyen]).join(" + ") || "sans paiement"}
          </div>
        </div>
      </div>

      {rendu > 0 ? (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
          <span className="font-medium">À rendre</span>
          <b className="text-3xl tabular-nums">{euros(rendu)}</b>
        </div>
      ) : null}

      <p className="mt-4 rounded-lg bg-[#FFF8C5] px-3 py-2 text-xs text-[#5C4A00]">
        Mode test : ticket non signé tant que fiskaltrust n&apos;est pas branché.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={imprimer}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0F172A] text-base font-semibold text-white"
        >
          <Printer className="size-5" />
          Imprimer le ticket
        </button>
        <button
          type="button"
          onClick={onNouvelleVente}
          className="h-12 rounded-xl border border-border text-base font-semibold hover:bg-muted"
        >
          Nouvelle vente <span className="text-xs font-normal text-muted-foreground">(Entrée)</span>
        </button>
      </div>
    </Modale>
  );
}
