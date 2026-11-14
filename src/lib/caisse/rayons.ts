export type RayonId = "trottinettes" | "atelier" | "accessoires";

export type Rayon = {
  id: RayonId;
  titre: string;
  sousTitre: string;
  couleur: string;
  categories: readonly string[];
};

export const RAYONS: readonly Rayon[] = [
  {
    id: "trottinettes",
    titre: "Trottinettes",
    sousTitre: "Véhicules neufs",
    couleur: "#0F172A",
    categories: ["Trottinette Tout Terrain", "Scooter", "Monocycle Gyropode"],
  },
  {
    id: "atelier",
    titre: "Atelier",
    sousTitre: "Pièces et main d'œuvre",
    couleur: "#EA580C",
    categories: [
      "Pneus / CAA / Valves",
      "Poignées / Leviers de frein",
      "Freinage / Étriers",
      "Plaquettes / Disques / Flasques",
      "Moteurs / Contrôleurs",
      "Accélérateurs",
      "Éclairage / Réflecteurs",
      "Clignotants",
      "Écrans / Displays",
      "Garde-boue",
      "Roues / Jantes",
      "Batteries",
      "Roulements / Axes / Joints",
      "Commandes / Comodos",
      "Visserie / Mécanique",
      "Faisceaux électriques",
      "Potence / Tube de direction",
      "Châssis",
      "Fourches / Suspensions",
      "Béquilles / Pliage",
      "Poignées / Grips",
      "Selle / Repose-pieds",
      "Klaxon / Sonnette",
      "Kits / Upgrade",
      "Amortisseur - Béquille - GYRO",
      "Batterie - GYRO",
      "CAA - PNEU - GYRO",
      "Carte Mère - GYRO",
      "Coque - Trolley - GB - GYRO",
      "Eclairage LED - Bandeau - GYRO",
      "Moteur - Roulement - GYRO",
      "Pad - GYRO",
      "Pédale - Sup - GYRO",
      "Consommable",
    ],
  },
  {
    id: "accessoires",
    titre: "Accessoires",
    sousTitre: "Équipements du rider",
    couleur: "#7C3AED",
    categories: [
      "Casques",
      "Cadenas & antivols",
      "Sacoches",
      "Chargeurs, embouts & ports de charge",
      "Supports téléphone",
      "Gants",
      "Pompes & gonflage",
      "Rétroviseurs",
      "Vêtements",
      "Stickers",
    ],
  },
];
