import type { Metadata } from "next";
import { ListeTickets } from "@/features/caisse/tickets/ListeTickets";
import { listerTickets } from "@/features/caisse/tickets/actions";

export const metadata: Metadata = {
  title: "Tickets",
};

export default async function Page() {
  const { tickets, portee } = await listerTickets("");
  return <ListeTickets initiaux={tickets} porteeInitiale={portee} />;
}
