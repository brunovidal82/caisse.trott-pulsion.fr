"use client";

import { Barcode, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { euros } from "@/lib/format";
import {
  calculerTotaux,
  type Acompte,
  type LignePanier,
  type Paiement,
} from "@/lib/caisse/panier";
import type { ApercuJournee, DossierPret } from "@/lib/caisse/types";
import {
  encaisserVente,
  produitParCode,
  rechercherProduits,
  type ProduitCaisse,
  type ResultatVente,
} from "./actions";
import { Encaissement, type Moyen } from "./Encaissement";
import { LigneLibre } from "./LigneLibre";
import { Panier } from "./Panier";
import { Rayons, TuileProduit } from "./Rayons";
import { VenteEnregistree } from "./VenteEnregistree";

type Props = {
  dossiers: DossierPret[];
  erreurDossiers: string | null;
  apercu: ApercuJournee | null;
};

let compteur = 0;
function nouvelleCle() {
  compteur += 1;
  return `l${Date.now()}-${compteur}`;
}

function typeLigneDossier(designation: string | null, produitId: number | null) {
  if (produitId !== null) return "produit" as const;
  return /main|m\.?o\b|oeuvre|œuvre/i.test(designation ?? "") ? ("main_oeuvre" as const) : ("divers" as const);
}

export function EcranVente({ dossiers, erreurDossiers, apercu }: Props) {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [dossier, setDossier] = useState<DossierPret | null>(null);
  const [acomptes, setAcomptes] = useState<Acompte[]>([]);
  const [clientNom, setClientNom] = useState("");
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ProduitCaisse[] | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [modale, setModale] = useState<
    | null
    | { type: "libre" }
    | { type: "encaissement"; moyen: Moyen }
    | { type: "fini"; resultat: Extract<ResultatVente, { ok: true }>; paiements: Paiement[] }
  >(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const derniereRecherche = useRef("");

  const totaux = calculerTotaux(lignes, acomptes);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        champRecherche.current?.focus();
        champRecherche.current?.select();
      }
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  const ajouterProduit = useCallback((produit: ProduitCaisse) => {
    setLignes((actuelles) => {
      const existante = actuelles.find((l) => l.produitId === produit.id && l.origine === "manuel");
      if (existante) {
        return actuelles.map((l) => (l.cle === existante.cle ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [
        ...actuelles,
        {
          cle: nouvelleCle(),
          type: "produit",
          produitId: produit.id,
          code: produit.code || null,
          designation: produit.designation,
          quantite: 1,
          prixUnitaireTtc: produit.prixTtc,
          remiseTtc: 0,
          tauxTva: produit.tauxTva,
          stock: produit.stock,
          origine: "manuel",
          photo: produit.photo,
          categorie: produit.categorie,
        },
      ];
    });
  }, []);

  function lancerRecherche(saisie: string) {
    setRecherche(saisie);
    if (minuteur.current) clearTimeout(minuteur.current);
    if (saisie.trim().length < 2) {
      setResultats(null);
      return;
    }
    minuteur.current = setTimeout(async () => {
      derniereRecherche.current = saisie;
      setRechercheEnCours(true);
      try {
        const trouves = await rechercherProduits(saisie);
        if (derniereRecherche.current === saisie) setResultats(trouves);
      } finally {
        setRechercheEnCours(false);
      }
    }, 250);
  }

  async function validerRecherche(e: React.FormEvent) {
    e.preventDefault();
    const saisie = recherche.trim();
    if (!saisie) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    const exact = await produitParCode(saisie);
    if (exact) {
      ajouterProduit(exact);
      setRecherche("");
      setResultats(null);
      return;
    }
    const trouves = await rechercherProduits(saisie);
    if (trouves.length === 1) {
      ajouterProduit(trouves[0]);
      setRecherche("");
      setResultats(null);
    } else {
      setResultats(trouves);
    }
  }

  function choisirResultat(produit: ProduitCaisse) {
    ajouterProduit(produit);
    setRecherche("");
    setResultats(null);
    champRecherche.current?.focus();
  }

  function chargerDossier(d: DossierPret) {
    setDossier(d);
    setClientNom(d.client_nom);
    setAcomptes(d.acomptes.map((a) => ({ ticketId: a.ticket_id, numero: a.numero, montant: Number(a.montant) })));
    setLignes((actuelles) => [
      ...actuelles.filter((l) => l.origine === "manuel"),
      ...d.lignes.map((l) => ({
        cle: nouvelleCle(),
        type: typeLigneDossier(l.designation, l.produit_id),
        produitId: l.produit_id,
        code: l.code,
        designation: l.designation?.trim() || "Article",
        quantite: Number(l.quantite),
        prixUnitaireTtc: Number(l.prix_unitaire_ttc),
        remiseTtc: 0,
        tauxTva: Number(l.taux_tva),
        stock: null,
        origine: "dossier" as const,
      })),
    ]);
  }

  function retirerDossier() {
    setDossier(null);
    setAcomptes([]);
    setClientNom("");
    setLignes((actuelles) => actuelles.filter((l) => l.origine === "manuel"));
  }

  function vider() {
    setLignes([]);
    setDossier(null);
    setAcomptes([]);
    setClientNom("");
  }

  async function enregistrer(paiements: Paiement[]) {
    const resultat = await encaisserVente({
      dossierId: dossier?.dossier_id ?? null,
      clientId: dossier?.client_id ?? null,
      clientNom: clientNom.trim() || null,
      acomptes: acomptes.map((a) => a.ticketId),
      lignes: lignes.map((l) => ({
        type: l.type,
        produitId: l.produitId,
        code: l.code,
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaireTtc: l.prixUnitaireTtc,
        remiseTtc: l.remiseTtc,
        tauxTva: l.tauxTva,
      })),
      paiements,
    });
    if (!resultat.ok) return resultat.erreur;
    setModale({ type: "fini", resultat, paiements });
    return null;
  }

  const moyens = apercu?.detail_moyens ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_460px]">
        <div className="flex flex-col gap-4">
          <form
            onSubmit={validerRecherche}
            className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4"
          >
            <Barcode className="size-6 text-muted-foreground" aria-hidden="true" />
            <label className="flex flex-1">
              <span className="sr-only">Scanner ou chercher un article</span>
              <input
                ref={champRecherche}
                value={recherche}
                onChange={(e) => lancerRecherche(e.target.value)}
                placeholder="Scanner un code-barres ou chercher : nom, code…"
                className="h-14 flex-1 bg-transparent text-lg outline-none"
                autoFocus
                autoComplete="off"
              />
            </label>
            {rechercheEnCours ? <Search className="size-5 animate-pulse text-muted-foreground" /> : null}
            <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              F2
            </span>
          </form>

          {resultats ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <b>
                  {resultats.length} résultat{resultats.length > 1 ? "s" : ""} pour « {recherche} »
                </b>
                <button
                  type="button"
                  onClick={() => {
                    setRecherche("");
                    setResultats(null);
                  }}
                  className="h-8 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
                >
                  Fermer
                </button>
              </div>
              {resultats.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucun article. Essaie un autre mot ou ajoute une ligne libre.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {resultats.map((p) => (
                    <TuileProduit key={p.id} produit={p} onChoisir={choisirResultat} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-sm">Dossiers atelier prêts</b>
              <span className="text-xs text-muted-foreground">
                un clic ajoute les lignes de la pré-facture et les acomptes
              </span>
            </div>
            {erreurDossiers ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreurDossiers}</p>
            ) : dossiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dossier terminé en attente d&apos;encaissement.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {dossiers.map((d) => {
                  const total = d.lignes.reduce(
                    (s, l) => s + Number(l.quantite) * Number(l.prix_unitaire_ttc),
                    0,
                  );
                  const acompte = d.acomptes.reduce((s, a) => s + Number(a.montant), 0);
                  const actif = dossier?.dossier_id === d.dossier_id;
                  return (
                    <button
                      key={d.dossier_id}
                      type="button"
                      onClick={() => chargerDossier(d)}
                      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-left ${
                        actif ? "border-2 border-[#EA580C] bg-[#FFF7ED]" : "border-[#FED7AA] bg-[#FFF7ED]/60"
                      }`}
                    >
                      <b className="truncate text-sm">
                        n°{d.dossier_id} · {d.marque_modele ?? "—"}
                      </b>
                      <span className="text-sm font-bold tabular-nums">{euros(total)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {d.client_nom || "Client"} · {d.lignes.length} ligne{d.lignes.length > 1 ? "s" : ""}
                        {d.prefacture_id ? "" : " · pas de pré-facture"}
                      </span>
                      <span className="text-xs font-semibold text-[#9f360a]">
                        {acompte > 0 ? `acompte ${euros(acompte)}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <Rayons onChoisir={ajouterProduit} />
        </div>

        <Panier
          lignes={lignes}
          totaux={totaux}
          acomptes={acomptes}
          dossier={dossier}
          clientNom={clientNom}
          onClientNom={setClientNom}
          onModifier={(cle, changement) =>
            setLignes((actuelles) => actuelles.map((l) => (l.cle === cle ? { ...l, ...changement } : l)))
          }
          onRetirer={(cle) => setLignes((actuelles) => actuelles.filter((l) => l.cle !== cle))}
          onRetirerDossier={retirerDossier}
          onVider={vider}
          onEncaisser={(moyen) => setModale({ type: "encaissement", moyen })}
          actionsSupplementaires={
            <button
              type="button"
              onClick={() => setModale({ type: "libre" })}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-medium hover:bg-muted"
            >
              <Plus className="size-4" />
              Ligne libre
            </button>
          }
        />
      </div>

      {apercu ? (
        <footer className="flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm">
          <span>
            <b>Aujourd&apos;hui</b> {apercu.nb_tickets} ticket{apercu.nb_tickets > 1 ? "s" : ""} ·{" "}
            {euros(apercu.total_ttc)} TTC
          </span>
          <span className="text-muted-foreground">
            CB {euros(moyens.cb ?? 0)} · espèces {euros(moyens.especes ?? 0)} · virement{" "}
            {euros(moyens.virement ?? 0)}
            {moyens.avoir ? ` · avoirs ${euros(moyens.avoir)}` : ""}
          </span>
        </footer>
      ) : null}

      {modale?.type === "libre" ? (
        <LigneLibre
          onFermer={() => setModale(null)}
          onAjouter={(ligne) => {
            setLignes((actuelles) => [...actuelles, { ...ligne, cle: nouvelleCle() }]);
            setModale(null);
          }}
        />
      ) : null}

      {modale?.type === "encaissement" ? (
        <Encaissement
          aPayer={totaux.aPayer}
          moyenInitial={modale.moyen}
          onAnnuler={() => setModale(null)}
          onValider={enregistrer}
        />
      ) : null}

      {modale?.type === "fini" ? (
        <VenteEnregistree
          resultat={modale.resultat}
          paiements={modale.paiements}
          onNouvelleVente={() => {
            vider();
            setModale(null);
            champRecherche.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
