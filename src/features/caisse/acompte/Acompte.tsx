"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Encaissement } from "@/features/caisse/vente/Encaissement";
import { Modale } from "@/features/caisse/vente/Modale";
import { VenteEnregistree } from "@/features/caisse/vente/VenteEnregistree";
import type { Paiement } from "@/lib/caisse/panier";
import { euros, lireMontant } from "@/lib/format";
import { chercherDossiers, encaisserAcompte, type DossierAcompte } from "./actions";

const STATUTS: Record<string, string> = {
  DEPOSE: "déposé",
  EN_COURS: "en cours",
  TERMINE: "terminé",
};

type Props = { onFermer: () => void };

export function Acompte({ onFermer }: Props) {
  const [etape, setEtape] = useState<"choix" | "paiement" | "fini">("choix");
  const [recherche, setRecherche] = useState("");
  const [dossiers, setDossiers] = useState<DossierAcompte[] | null>(null);
  const [dossier, setDossier] = useState<DossierAcompte | null>(null);
  const [montant, setMontant] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ ticketId: string; numero: number; totalTtc: number } | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const montantSaisi = lireMontant(montant);

  async function chercher(saisie: string) {
    setErreur(null);
    try {
      setDossiers(await chercherDossiers(saisie));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Recherche impossible.");
    }
  }

  useEffect(() => {
    let annule = false;
    chercherDossiers("")
      .then((liste) => {
        if (!annule) setDossiers(liste);
      })
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : "Recherche impossible.");
      });
    return () => {
      annule = true;
    };
  }, []);

  function saisir(valeur: string) {
    setRecherche(valeur);
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => chercher(valeur), 300);
  }

  async function enregistrer(liste: Paiement[]) {
    if (!dossier || montantSaisi === null) return "Choisis un dossier et un montant.";
    const r = await encaisserAcompte({
      dossierId: dossier.id,
      montant: montantSaisi,
      clientId: dossier.clientId,
      clientNom: dossier.clientNom || null,
      paiements: liste,
    });
    if (!r.ok) return r.erreur;
    setPaiements(liste);
    setResultat(r);
    setEtape("fini");
    return null;
  }

  if (etape === "paiement" && montantSaisi !== null) {
    return (
      <Encaissement
        aPayer={montantSaisi}
        moyenInitial="cb"
        onAnnuler={() => setEtape("choix")}
        onValider={enregistrer}
      />
    );
  }

  if (etape === "fini" && resultat && dossier) {
    return (
      <VenteEnregistree
        titre="Acompte enregistré"
        libelle="Acompte"
        detail={`Dossier n°${dossier.id}${dossier.clientNom ? ` · ${dossier.clientNom}` : ""} · déduit automatiquement à l'encaissement final`}
        resultat={resultat}
        paiements={paiements}
        onNouvelleVente={onFermer}
      />
    );
  }

  const dejaVerse = dossier ? dossier.acomptes.reduce((s, a) => s + a.montant, 0) : 0;

  return (
    <Modale titre="Encaisser un acompte" onFermer={onFermer} largeur="max-w-2xl">
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 rounded-xl border border-border px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Chercher un dossier atelier</span>
          <input
            value={recherche}
            onChange={(e) => saisir(e.target.value)}
            placeholder="N° de dossier, nom du client, téléphone ou modèle"
            className="h-11 flex-1 bg-transparent outline-none"
            autoFocus
          />
        </label>

        {erreur ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p> : null}

        {!dossiers ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : dossiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun dossier atelier non livré ne correspond.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-border">
            {dossiers.map((d) => {
              const actif = dossier?.id === d.id;
              const verse = d.acomptes.reduce((s, a) => s + a.montant, 0);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setDossier(d)}
                    className="grid w-full items-center gap-x-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                    style={{
                      gridTemplateColumns: "1fr auto",
                      backgroundColor: actif ? "#FFF7ED" : undefined,
                      boxShadow: actif ? "inset 3px 0 0 #EA580C" : undefined,
                    }}
                  >
                    <b className="truncate">
                      n°{d.id} · {d.marqueModele ?? "—"}
                    </b>
                    <span className="text-xs text-muted-foreground">{STATUTS[d.statut ?? ""] ?? d.statut}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {d.clientNom || "Client"}
                      {d.telephone ? ` · ${d.telephone}` : ""}
                      {d.devis ? ` · devis ${euros(d.devis)}` : ""}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "#9f360a" }}>
                      {verse > 0 ? `acompte ${euros(verse)}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {dossier ? (
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
            <div className="text-sm">
              Dossier <b>n°{dossier.id}</b> · {dossier.marqueModele ?? "—"} · {dossier.clientNom || "Client"}
              {dejaVerse > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  Déjà versé : {euros(dejaVerse)} ({dossier.acomptes.length} acompte
                  {dossier.acomptes.length > 1 ? "s" : ""})
                </span>
              ) : null}
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Montant de l&apos;acompte (TTC)
              <input
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder={dossier.devis ? (dossier.devis * 0.3).toFixed(2).replace(".", ",") : "50,00"}
                className="h-12 rounded-xl border border-border bg-white px-3 text-lg tabular-nums"
                autoFocus
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Ticket d&apos;acompte à 20 % de TVA. Il sera déduit tout seul quand tu encaisseras ce dossier.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!dossier || montantSaisi === null || montantSaisi <= 0}
          onClick={() => setEtape("paiement")}
          className="h-14 rounded-xl text-base font-semibold"
          style={{
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
            opacity: !dossier || montantSaisi === null || montantSaisi <= 0 ? 0.4 : 1,
          }}
        >
          {montantSaisi ? `Encaisser l'acompte de ${euros(montantSaisi)}` : "Encaisser l'acompte"}
        </button>
      </div>
    </Modale>
  );
}
