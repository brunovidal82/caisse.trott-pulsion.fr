import { describe, expect, it } from "vitest";
import { bornesPeriode, ecartCaisse, periodesPrecedentes, remiseEnBanque } from "./cloture";

describe("clôture", () => {
  it("calcule l'écart et la remise en banque au centime", () => {
    expect(ecartCaisse(372.2, 370.2)).toBe(-2);
    expect(ecartCaisse(0.3, 0.3)).toBe(0);
    expect(remiseEnBanque(370.2, 150)).toBe(220.2);
  });

  it("trouve le mois et l'année précédents", () => {
    expect(periodesPrecedentes("2026-11-16")).toEqual({ mois: "2026-10", an: "2025" });
    expect(periodesPrecedentes("2027-01-02")).toEqual({ mois: "2026-12", an: "2026" });
  });

  it("donne les bornes d'une période", () => {
    expect(bornesPeriode("2026-12")).toEqual({ debut: "2026-12-01", fin: "2027-01-01" });
    expect(bornesPeriode("2026")).toEqual({ debut: "2026-01-01", fin: "2027-01-01" });
  });
});
