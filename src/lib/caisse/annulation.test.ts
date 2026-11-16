import { describe, expect, it } from "vitest";
import { montantAnnule, resteAnnulable, totalRembourse, type LigneAnnulable } from "./annulation";

const pneu: LigneAnnulable = { id: "a", quantite: 2, totalTtc: 55, dejaQuantite: 0, dejaTtc: 0 };
const mo: LigneAnnulable = { id: "b", quantite: 1, totalTtc: 40, dejaQuantite: 0, dejaTtc: 0 };

describe("annulation", () => {
  it("reproduit le scénario testé en base", () => {
    expect(montantAnnule(pneu, 1)).toBe(27.5);
    const apres = { ...pneu, dejaQuantite: 1, dejaTtc: 27.5 };
    expect(resteAnnulable(apres)).toBe(1);
    expect(totalRembourse([apres, mo], { a: 1, b: 1 })).toBe(67.5);
  });

  it("solde exactement la ligne au dernier morceau", () => {
    const ligne: LigneAnnulable = { id: "c", quantite: 3, totalTtc: 10, dejaQuantite: 1, dejaTtc: 3.33 };
    expect(montantAnnule(ligne, 2)).toBe(6.67);
    expect(montantAnnule(ligne, 0)).toBe(0);
  });
});
