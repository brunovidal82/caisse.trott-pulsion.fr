"use client";

import { Printer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ImpressionAuto() {
  const params = useSearchParams();
  const auto = params.get("impression") === "1";

  useEffect(() => {
    if (!auto) return;
    const minuteur = setTimeout(() => window.print(), 300);
    return () => clearTimeout(minuteur);
  }, [auto]);

  return (
    <div className="ticket-actions mx-auto mb-4 flex w-[72mm] justify-center">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#0F172A] px-4 text-sm font-semibold text-white"
      >
        <Printer className="size-4" />
        Imprimer
      </button>
    </div>
  );
}
