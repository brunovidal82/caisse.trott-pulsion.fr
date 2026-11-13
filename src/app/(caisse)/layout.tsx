import { redirect } from "next/navigation";
import { EnTeteCaisse } from "@/features/caisse/EnTeteCaisse";
import { journeeOuverte, vendeurConnecte } from "@/lib/caisse/session";

export default async function CaisseLayout({ children }: LayoutProps<"/">) {
  const vendeur = await vendeurConnecte();
  if (!vendeur) redirect("/vendeur");

  const journee = await journeeOuverte();

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-[#F3F4F6] p-4 lg:p-6">
      <EnTeteCaisse vendeur={vendeur} journee={journee} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
