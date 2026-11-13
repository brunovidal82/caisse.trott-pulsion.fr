"use client";

import { Delete } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { connecterVendeur, type EtatFormulaire } from "@/features/caisse/actions";
import { initiales } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = { vendeurs: { id: string; prenom: string }[] };

const TOUCHES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function ChoixVendeur({ vendeurs }: Props) {
  const [vendeurId, setVendeurId] = useState(
    vendeurs.length === 1 ? vendeurs[0].id : "",
  );
  const [pin, setPin] = useState("");
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    connecterVendeur,
    {},
  );
  const [etatVu, setEtatVu] = useState(etat);

  if (etat !== etatVu) {
    setEtatVu(etat);
    setPin("");
  }

  function taper(chiffre: string) {
    setPin((p) => (p.length < 6 ? p + chiffre : p));
  }

  useEffect(() => {
    if (!vendeurId) return;
    function surTouche(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [vendeurId]);

  return (
    <form action={action} className="mt-6 flex flex-col items-center gap-6">
      <input type="hidden" name="vendeur_id" value={vendeurId} />
      <input type="hidden" name="pin" value={pin} />

      <div className="flex flex-wrap justify-center gap-3">
        {vendeurs.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setVendeurId(v.id);
              setPin("");
            }}
            className={cn(
              "flex w-28 flex-col items-center gap-2 rounded-xl border p-3 text-sm font-semibold",
              vendeurId === v.id
                ? "border-2 border-[#0F172A] bg-slate-50"
                : "border-border bg-white hover:border-slate-400",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-[#9f360a] text-base font-bold text-white">
              {initiales(v.prenom)}
            </span>
            {v.prenom}
          </button>
        ))}
      </div>

      {vendeurId ? (
        <>
          <div className="flex h-6 items-center gap-3" aria-label="Code saisi">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-3.5 rounded-full border-2 border-[#0F172A]",
                  i < pin.length && "bg-[#0F172A]",
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {TOUCHES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => taper(t)}
                className="h-14 w-20 rounded-xl border border-border bg-white text-xl font-semibold hover:bg-muted"
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="flex h-14 w-20 items-center justify-center rounded-xl border border-border bg-white hover:bg-muted"
              aria-label="Effacer"
            >
              <Delete className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => taper("0")}
              className="h-14 w-20 rounded-xl border border-border bg-white text-xl font-semibold hover:bg-muted"
            >
              0
            </button>
            <button
              type="submit"
              disabled={pin.length < 4 || enCours}
              className="h-14 w-20 rounded-xl bg-[#0F172A] text-sm font-semibold text-white disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Choisis ton prénom.</p>
      )}

      {etat.erreur ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.erreur}
        </p>
      ) : null}
    </form>
  );
}
