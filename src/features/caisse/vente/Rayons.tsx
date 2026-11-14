"use client";

import { Bike, HardHat, Pencil, Wrench } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { euros } from "@/lib/format";
import {
  ICONES_PAR_DEFAUT,
  cheminIcone,
  enregistrerIconesChoisies,
  lireIconesChoisies,
  type Icone,
} from "@/lib/caisse/icones";
import { RAYONS, type RayonId } from "@/lib/caisse/rayons";
import { produitsDeCategorie, type ProduitCaisse } from "./actions";
import { ChoixIcone } from "./ChoixIcone";
import { PhotoProduit } from "./PhotoProduit";

const ICONES: Record<RayonId, typeof Bike> = {
  trottinettes: Bike,
  atelier: Wrench,
  accessoires: HardHat,
};

type Props = { onChoisir: (produit: ProduitCaisse) => void };

export function Rayons({ onChoisir }: Props) {
  const [rayonId, setRayonId] = useState<RayonId | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [produits, setProduits] = useState<ProduitCaisse[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [iconesChoisies, setIconesChoisies] = useState<Record<string, Icone> | null>(null);
  const [iconeAChanger, setIconeAChanger] = useState<string | null>(null);

  function iconeDe(categorie: string): Icone {
    return iconesChoisies?.[categorie] ?? ICONES_PAR_DEFAUT[categorie] ?? "checked";
  }

  function changerIcone(categorie: string, icone: Icone) {
    const suivantes = { ...(iconesChoisies ?? {}), [categorie]: icone };
    setIconesChoisies(suivantes);
    enregistrerIconesChoisies(suivantes);
    setIconeAChanger(null);
  }

  const rayon = RAYONS.find((r) => r.id === rayonId) ?? null;

  async function ouvrirCategorie(nom: string) {
    setCategorie(nom);
    setProduits(null);
    setErreur(null);
    try {
      setProduits(await produitsDeCategorie(nom));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }

  async function ouvrirRayon(id: RayonId) {
    if (iconesChoisies === null) setIconesChoisies(lireIconesChoisies());
    setRayonId(id);
    setCategorie(null);
    setProduits(null);
    const cible = RAYONS.find((r) => r.id === id);
    if (cible && cible.categories.length === 1) await ouvrirCategorie(cible.categories[0]);
  }

  if (!rayon) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {RAYONS.map((r) => {
          const Icone = ICONES[r.id];
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => ouvrirRayon(r.id)}
              className="flex h-48 flex-col items-start gap-2 rounded-2xl border border-border bg-white p-4 text-left hover:border-[#0F172A]"
            >
              <span
                className="flex h-24 w-full items-center justify-center rounded-xl"
                style={{ backgroundColor: `${r.couleur}12` }}
              >
                {r.id === "atelier" ? (
                  <Image src={cheminIcone("tools")} alt="" width={80} height={80} className="size-20 object-contain" />
                ) : (
                  <Icone className="size-14" style={{ color: r.couleur }} strokeWidth={1.6} />
                )}
              </span>
              <b className="text-lg">{r.titre}</b>
              <span className="text-sm text-muted-foreground">{r.sousTitre}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRayonId(null);
            setCategorie(null);
            setProduits(null);
          }}
          className="h-8 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          ← Rayons
        </button>
        {categorie && rayon.categories.length > 1 ? (
          <button
            type="button"
            onClick={() => {
              setCategorie(null);
              setProduits(null);
            }}
            className="h-8 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            ← {rayon.titre}
          </button>
        ) : null}
        <b className="text-base">{categorie ?? rayon.titre}</b>
        {produits ? <span className="text-sm text-muted-foreground">{produits.length} articles</span> : null}
      </div>

      {!categorie ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
          {rayon.categories.map((c) =>
            rayon.id === "atelier" ? (
              <div key={c} className="group relative">
                <button
                  type="button"
                  onClick={() => ouvrirCategorie(c)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-semibold hover:border-slate-400"
                >
                  <Image
                    src={cheminIcone(iconeDe(c))}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 shrink-0 object-contain"
                  />
                  <span className="pr-6">{c}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIconeAChanger(c)}
                  className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-lg bg-white/90 text-muted-foreground opacity-0 shadow-sm group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                  aria-label={`Changer l'icône de ${c}`}
                  title="Changer l'icône"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                key={c}
                type="button"
                onClick={() => ouvrirCategorie(c)}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-left text-sm font-semibold hover:border-slate-400"
              >
                <i className="h-8 w-1.5 shrink-0 rounded" style={{ backgroundColor: rayon.couleur }} />
                {c}
              </button>
            ),
          )}
        </div>
      ) : erreur ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>
      ) : !produits ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
      ) : produits.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucun article dans cette catégorie.</p>
      ) : (
        <div
          className={
            rayon.id === "trottinettes"
              ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
              : "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {produits.map((p) => (
            <TuileProduit key={p.id} produit={p} onChoisir={onChoisir} grand={rayon.id === "trottinettes"} />
          ))}
        </div>
      )}

      {iconeAChanger ? (
        <ChoixIcone
          categorie={iconeAChanger}
          actuelle={iconeDe(iconeAChanger)}
          onChoisir={(icone) => changerIcone(iconeAChanger, icone)}
          onFermer={() => setIconeAChanger(null)}
        />
      ) : null}
    </section>
  );
}

export function TuileProduit({
  produit,
  onChoisir,
  grand = false,
}: {
  produit: ProduitCaisse;
  onChoisir: (produit: ProduitCaisse) => void;
  grand?: boolean;
}) {
  const stockBas = produit.stock !== null && produit.stock <= 0;
  const stock = (
    <small className={`text-xs ${stockBas ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>
      {produit.stock === null ? "" : produit.stock <= 0 ? "rupture" : `${produit.stock} en stock`}
    </small>
  );

  if (grand) {
    return (
      <button
        type="button"
        onClick={() => onChoisir(produit)}
        className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3 text-left hover:border-slate-400"
      >
        <PhotoProduit photo={produit.photo} categorie={produit.categorie} designation={produit.designation} taille={150} pleineLargeur />
        <b className="line-clamp-2 text-sm leading-tight font-semibold">{produit.designation}</b>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold tabular-nums">{euros(produit.prixTtc)}</span>
          {stock}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onChoisir(produit)}
      className="grid min-h-16 items-center gap-x-3 rounded-xl border border-border bg-white px-2 py-2 text-left hover:border-slate-400"
      style={{ gridTemplateColumns: "auto 1fr auto" }}
    >
      <span style={{ gridRow: "span 2" }}>
        <PhotoProduit photo={produit.photo} categorie={produit.categorie} designation={produit.designation} taille={52} />
      </span>
      <b className="line-clamp-2 text-sm leading-tight font-semibold">{produit.designation}</b>
      <span className="text-sm font-bold tabular-nums">{euros(produit.prixTtc)}</span>
      <small className="truncate text-xs text-muted-foreground">{produit.code}</small>
      {stock}
    </button>
  );
}
