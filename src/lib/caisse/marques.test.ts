import { describe, expect, it } from "vitest";
import { compterMarques, marqueDe, trierParMarque } from "./marques";

describe("marques", () => {
  it("prend la marque saisie, sinon la devine dans la désignation", () => {
    expect(marqueDe("dualtron", "Thunder 3")).toBe("Dualtron");
    expect(marqueDe(null, "Trottinette Teverun Supreme Ultra")).toBe("Teverun");
    expect(marqueDe("", "Kukirin G2 Pro")).toBe("Kukirin");
    expect(marqueDe(null, "Modèle inconnu")).toBe("Autres");
    expect(marqueDe("  NOUVELLE ", "x")).toBe("NOUVELLE");
  });

  it("compte et trie, « Autres » en dernier", () => {
    const articles = [
      { marque: "Xiaomi", designation: "Pro 2" },
      { marque: "Autres", designation: "A" },
      { marque: "Dualtron", designation: "Thunder 3" },
      { marque: "Dualtron", designation: "Mini" },
    ];
    expect(compterMarques(articles)).toEqual([
      { marque: "Dualtron", nombre: 2 },
      { marque: "Xiaomi", nombre: 1 },
      { marque: "Autres", nombre: 1 },
    ]);
    expect(trierParMarque(articles).map((a) => a.designation)).toEqual(["Mini", "Thunder 3", "Pro 2", "A"]);
  });
});
