"use client";

import { Search, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import type { ClientTrouve } from "@/lib/caisse/clients";
import { chercherClients } from "./actions";

const SOURCES: Record<string, string> = { atelier: "atelier", facture: "facture", hiboutik: "Hiboutik" };

type Props = {
  onChoisir: (client: ClientTrouve) => void;
  placeholder?: string;
  valeur?: string;
  onSaisie?: (texte: string) => void;
  className?: string;
};

export function RechercheClient({ onChoisir, placeholder = "Chercher un client : nom ou téléphone", valeur, onSaisie, className = "" }: Props) {
  const [texteLocal, setTexteLocal] = useState("");
  const [resultats, setResultats] = useState<ClientTrouve[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniere = useRef("");

  const texte = valeur ?? texteLocal;

  function saisir(v: string) {
    if (onSaisie) onSaisie(v);
    else setTexteLocal(v);
    if (minuteur.current) clearTimeout(minuteur.current);
    if (v.trim().length < 2) {
      setResultats([]);
      setOuvert(false);
      return;
    }
    minuteur.current = setTimeout(async () => {
      derniere.current = v;
      setChargement(true);
      try {
        const r = await chercherClients(v);
        if (derniere.current === v) {
          setResultats(r);
          setOuvert(true);
        }
      } catch {
        setResultats([]);
      } finally {
        setChargement(false);
      }
    }, 300);
  }

  return (
    <div className={`relative ${className}`}>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{placeholder}</span>
        <input
          value={texte}
          onChange={(e) => saisir(e.target.value)}
          onFocus={() => resultats.length > 0 && setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
        {chargement ? <span className="text-xs text-muted-foreground">…</span> : null}
      </label>
      {ouvert ? (
        <ul
          className="absolute right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-white shadow-lg"
          role="listbox"
        >
          {resultats.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Aucun client connu.</li>
          ) : (
            resultats.map((c) => (
              <li key={c.cle}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChoisir(c);
                    setOuvert(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">
                      {[c.prenom, c.nom].filter(Boolean).join(" ")}
                      {c.type === "business" ? " (pro)" : ""}
                    </b>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.telephone, c.email, c.adresse].filter(Boolean).join(" · ") || "sans coordonnées"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {c.sources.map((s) => SOURCES[s] ?? s).join(", ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
