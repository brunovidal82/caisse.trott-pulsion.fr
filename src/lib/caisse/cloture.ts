import { enCentimes, enEuros } from "./panier";

export function ecartCaisse(attendues: number, comptees: number) {
  return enEuros(enCentimes(comptees) - enCentimes(attendues));
}

export function remiseEnBanque(comptees: number, fondLaisse: number) {
  return enEuros(enCentimes(comptees) - enCentimes(fondLaisse));
}

export function dateParis(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function periodesPrecedentes(jour: string) {
  const [annee, mois] = jour.split("-").map(Number);
  const moisPrecedent = mois === 1 ? `${annee - 1}-12` : `${annee}-${String(mois - 1).padStart(2, "0")}`;
  return { mois: moisPrecedent, an: String(annee - 1) };
}

export function bornesPeriode(periode: string) {
  if (/^\d{4}-\d{2}$/.test(periode)) {
    const [annee, mois] = periode.split("-").map(Number);
    const fin = mois === 12 ? `${annee + 1}-01-01` : `${annee}-${String(mois + 1).padStart(2, "0")}-01`;
    return { debut: `${periode}-01`, fin };
  }
  return { debut: `${periode}-01-01`, fin: `${Number(periode) + 1}-01-01` };
}
