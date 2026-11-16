import Link from "next/link";
import { changerVendeur, quitterCaisse } from "@/features/caisse/actions";
import type { Journee, Vendeur } from "@/lib/caisse/session";
import { euros, heure, initiales } from "@/lib/format";

type Props = { vendeur: Vendeur; journee: Journee | null };

export function EnTeteCaisse({ vendeur, journee }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-[linear-gradient(90deg,#7a2500,#9f360a_55%,#c76126)] px-5 py-3 text-white">
      <span className="text-[11px] font-semibold tracking-[0.14em] text-[#FFE7D6]">
        ATELIER TROTT PULSION
      </span>
      <h1 className="text-lg font-bold">Caisse</h1>
      <span className="text-[13px] text-[#FFE7D6]">
        {journee
          ? `Journée n°${journee.numero} · ouverte à ${heure(journee.ouverte_le)} · fond ${euros(journee.fond_ouverture)}`
          : "Journée fermée"}
      </span>
      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
        Mode test
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 py-1 pr-3 pl-1 text-sm">
          <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#9f360a]">
            {initiales(vendeur.prenom)}
          </span>
          {vendeur.prenom}
        </span>
        {journee ? (
          <Link
            href="/cloture"
            className="h-8 rounded-lg bg-white/15 px-3 text-sm leading-8 font-medium hover:bg-white/25"
          >
            Clôturer la journée
          </Link>
        ) : null}
        <form action={changerVendeur}>
          <button
            type="submit"
            className="h-8 rounded-lg bg-white/15 px-3 text-sm font-medium hover:bg-white/25"
          >
            Changer de vendeur
          </button>
        </form>
        <form action={quitterCaisse}>
          <button
            type="submit"
            className="h-8 rounded-lg bg-white px-3 text-sm font-medium text-[#0F172A] hover:bg-white/90"
          >
            Quitter
          </button>
        </form>
      </div>
    </header>
  );
}
