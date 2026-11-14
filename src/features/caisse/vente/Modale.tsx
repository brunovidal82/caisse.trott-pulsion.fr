"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  titre: string;
  onFermer?: () => void;
  largeur?: string;
  children: React.ReactNode;
};

export function Modale({ titre, onFermer, largeur = "max-w-lg", children }: Props) {
  useEffect(() => {
    if (!onFermer) return;
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer?.();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`w-full ${largeur} max-h-[92dvh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{titre}</h2>
          {onFermer ? (
            <button
              type="button"
              onClick={onFermer}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
