import { describe, expect, it } from "vitest";
import {
  billetsRapides,
  calculerTotaux,
  htDepuisTtcCentimes,
  numeroTicket,
  renduMonnaie,
  resteAPayer,
  ttcLigneCentimes,
  type LignePanier,
} from "./panier";

function ligne(partiel: Partial<LignePanier>): LignePanier {
  return {
    cle: "x",
    type: "produit",
    produitId: 1,
    code: "P1",
    designation: "Pneu",
    quantite: 1,
    prixUnitaireTtc: 0,
    remiseTtc: 0,
    tauxTva: 20,
    stock: null,
    origine: "manuel",
    ...partiel,
  };
}

describe("calculs de ligne", () => {
  it("arrondit comme la base", () => {
    expect(ttcLigneCentimes({ quantite: 2, prixUnitaireTtc: 30, remiseTtc: 5 })).toBe(5500);
    expect(ttcLigneCentimes({ quantite: 1.5, prixUnitaireTtc: 3.33, remiseTtc: 0 })).toBe(500);
    expect(htDepuisTtcCentimes(5500, 20)).toBe(4583);
    expect(htDepuisTtcCentimes(4000, 20)).toBe(3333);
    expect(htDepuisTtcCentimes(1000, 5.5)).toBe(948);
  });
});

describe("totaux", () => {
  it("reproduit le scénario testé en base", () => {
    const t = calculerTotaux(
      [
        ligne({ quantite: 2, prixUnitaireTtc: 30, remiseTtc: 5 }),
        ligne({ type: "main_oeuvre", produitId: null, prixUnitaireTtc: 40 }),
      ],
      [{ ticketId: "a", numero: 1, montant: 50 }],
    );
    expect(t.ttc).toBe(95);
    expect(t.ht).toBe(79.16);
    expect(t.tva).toBe(15.84);
    expect(t.aPayer).toBe(45);
  });

  it("sépare les taux", () => {
    const t = calculerTotaux([
      ligne({ prixUnitaireTtc: 12 }),
      ligne({ prixUnitaireTtc: 10, tauxTva: 5.5 }),
    ]);
    expect(t.parTaux.map((p) => p.taux)).toEqual([20, 5.5]);
    expect(t.ttc).toBe(22);
  });
});

describe("paiements", () => {
  it("calcule le reste et le rendu", () => {
    const paiements = [
      { moyen: "cb" as const, montant: 20 },
      { moyen: "especes" as const, montant: 25, especesRecues: 30 },
    ];
    expect(resteAPayer(45, paiements)).toBe(0);
    expect(renduMonnaie(paiements)).toBe(5);
  });

  it("propose des billets au-dessus du montant", () => {
    expect(billetsRapides(59.8)).toEqual([60, 70, 80, 100]);
    expect(billetsRapides(20)).toEqual([25, 30, 40, 50]);
  });

  it("formate le numéro", () => {
    expect(numeroTicket(15)).toBe("T-0015");
  });
});
