import { describe, expect, it } from "vitest";
import { initiales, lireMontant } from "./format";

describe("lireMontant", () => {
  it("accepte la virgule et les espaces", () => {
    expect(lireMontant("150,50")).toBe(150.5);
    expect(lireMontant(" 1 200 ")).toBe(1200);
    expect(lireMontant("80 €")).toBe(80);
  });

  it("refuse les saisies invalides", () => {
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("-5")).toBeNull();
    expect(lireMontant("12,345")).toBeNull();
    expect(lireMontant("abc")).toBeNull();
    expect(lireMontant(null)).toBeNull();
  });
});

describe("initiales", () => {
  it("prend les deux premières lettres", () => {
    expect(initiales("bruno")).toBe("BR");
  });
});
