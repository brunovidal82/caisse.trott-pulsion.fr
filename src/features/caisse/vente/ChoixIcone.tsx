"use client";

import Image from "next/image";
import { ICONES, cheminIcone, type Icone } from "@/lib/caisse/icones";
import { Modale } from "./Modale";

type Props = {
  categorie: string;
  actuelle: Icone | null;
  onChoisir: (icone: Icone) => void;
  onFermer: () => void;
};

export function ChoixIcone({ categorie, actuelle, onChoisir, onFermer }: Props) {
  return (
    <Modale titre={`Icône · ${categorie}`} onFermer={onFermer} largeur="max-w-3xl">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {ICONES.map((icone) => (
          <button
            key={icone}
            type="button"
            onClick={() => onChoisir(icone)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] text-muted-foreground hover:bg-muted ${
              actuelle === icone ? "border-2 border-[#EA580C] bg-[#FFF7ED]" : "border-transparent"
            }`}
          >
            <Image src={cheminIcone(icone)} alt="" width={44} height={44} className="size-11 object-contain" />
            <span className="w-full truncate text-center">{icone.replace("_", " ")}</span>
          </button>
        ))}
      </div>
    </Modale>
  );
}
