"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cheminIcone, iconeArticle } from "@/lib/caisse/icones";

type Props = {
  photo: string | null | undefined;
  categorie?: string | null;
  designation?: string | null;
  taille?: number;
  pleineLargeur?: boolean;
  className?: string;
};

export function PhotoProduit({ photo, categorie, designation, taille = 56, pleineLargeur = false, className = "" }: Props) {
  const [enErreur, setEnErreur] = useState(false);
  const icone = iconeArticle(designation, categorie);
  const style = { width: pleineLargeur ? "100%" : taille, height: taille };

  if (photo && !enErreur) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ${className}`}
        style={{ ...style, position: "relative", overflow: "hidden" }}
      >
        <Image
          src={photo}
          alt=""
          width={taille}
          height={taille}
          unoptimized
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onError={() => setEnErreur(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-slate-50 ${className}`}
      style={style}
    >
      {icone ? (
        <Image
          src={cheminIcone(icone)}
          alt=""
          width={taille}
          height={taille}
          className="object-contain opacity-70"
          style={{ width: taille * 0.75, height: taille * 0.75 }}
        />
      ) : (
        <Package className="text-slate-300" style={{ width: taille * 0.5, height: taille * 0.5 }} />
      )}
    </span>
  );
}
