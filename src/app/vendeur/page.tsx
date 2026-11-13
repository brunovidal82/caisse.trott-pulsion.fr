import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChoixVendeur } from "@/features/caisse/ChoixVendeur";
import { vendeurConnecte } from "@/lib/caisse/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Vendeur",
};

export default async function Page() {
  if (await vendeurConnecte()) redirect("/");

  const supabase = await createClient();
  const { data: vendeurs, error } = await supabase
    .schema("caisse")
    .from("vendeurs")
    .select("id, prenom")
    .eq("actif", true)
    .order("prenom");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F3F4F6] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold">Qui encaisse ?</h1>
        {error ? (
          <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message}
          </p>
        ) : vendeurs && vendeurs.length > 0 ? (
          <ChoixVendeur vendeurs={vendeurs} />
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Aucun vendeur. Crée-le dans Supabase avec
            <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
              select caisse.creer_vendeur(&apos;Prénom&apos;, &apos;admin&apos;, &apos;1234&apos;);
            </code>
          </p>
        )}
      </div>
    </div>
  );
}
