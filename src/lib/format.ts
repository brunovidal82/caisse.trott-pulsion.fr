const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function euros(montant: number | string | null | undefined) {
  return formatEuros.format(Number(montant ?? 0));
}

export function heure(date: string | Date) {
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function lireMontant(saisie: FormDataEntryValue | null) {
  if (typeof saisie !== "string") return null;
  const propre = saisie.replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Number(propre);
}

export function initiales(prenom: string) {
  return prenom.trim().slice(0, 2).toUpperCase();
}
