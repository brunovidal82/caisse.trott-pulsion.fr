import { describe, expect, it } from "vitest";
import { cleClient, fusionnerClients, motifTelephone, type FicheBrute } from "./clients";

const base: FicheBrute = {
  type: "individual",
  prenom: "Paul",
  nom: "Martin",
  telephone: "06 12 34 56 78",
  email: "",
  adresse: "",
  siren: "",
  tva: "",
  dernier: "2026-10-01",
  source: "atelier",
};

describe("clients", () => {
  it("reconnaît le même client par son téléphone", () => {
    expect(cleClient(base)).toBe(cleClient({ ...base, telephone: "+33612345678" }));
  });

  it("fusionne les fiches et garde l'info la plus récente", () => {
    const [c] = fusionnerClients([
      base,
      { ...base, telephone: "0612345678", adresse: "1 rue A, 82000 Montauban", dernier: "2026-11-10", source: "facture" },
      { ...base, email: "paul@exemple.fr", dernier: "2025-01-01", source: "hiboutik" },
    ]);
    expect(c.adresse).toBe("1 rue A, 82000 Montauban");
    expect(c.email).toBe("paul@exemple.fr");
    expect(c.sources).toEqual(["atelier", "facture", "hiboutik"]);
    expect(c.dernier).toBe("2026-11-10");
  });

  it("transforme un numéro en motif de recherche", () => {
    expect(motifTelephone("0612")).toBe("%0%6%1%2%");
    expect(motifTelephone("Martin")).toBeNull();
  });
});
