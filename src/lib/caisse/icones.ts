export const ICONES = [
  "arm", "axis", "bag", "battery", "bearing", "braking", "cables", "caliper",
  "chambre_air", "charger", "checked", "comodo", "controller", "convertor", "deck", "disc", "display",
  "electronics", "fold", "foot", "frame", "handlebar", "handlebar_grip", "horn", "kickstand",
  "kit", "lever", "lights", "motor", "mudguard", "pads", "protection", "reflector",
  "refurbished", "screw", "sealer", "seat", "spring", "steering", "stem", "stickers",
  "suspension", "throttle", "tire", "tools", "tube", "upgrade", "valve", "wheel",
  "wires", "y_arm",
] as const;

export type Icone = (typeof ICONES)[number];

export function cheminIcone(icone: Icone) {
  return `/icons/atelier/ic_${icone}.png`;
}

export const ICONES_PAR_DEFAUT: Record<string, Icone> = {
  "Pneus / CAA / Valves": "tire",
  "Poignées / Leviers de frein": "lever",
  "Freinage / Étriers": "caliper",
  "Plaquettes / Disques / Flasques": "pads",
  "Moteurs / Contrôleurs": "motor",
  "Accélérateurs": "throttle",
  "Éclairage / Réflecteurs": "lights",
  "Clignotants": "reflector",
  "Écrans / Displays": "display",
  "Garde-boue": "mudguard",
  "Roues / Jantes": "wheel",
  "Batteries": "battery",
  "Roulements / Axes / Joints": "bearing",
  "Commandes / Comodos": "comodo",
  "Visserie / Mécanique": "screw",
  "Faisceaux électriques": "wires",
  "Potence / Tube de direction": "stem",
  "Châssis": "frame",
  "Fourches / Suspensions": "suspension",
  "Béquilles / Pliage": "kickstand",
  "Poignées / Grips": "handlebar_grip",
  "Selle / Repose-pieds": "seat",
  "Klaxon / Sonnette": "horn",
  "Kits / Upgrade": "upgrade",
  "Amortisseur - Béquille - GYRO": "spring",
  "Batterie - GYRO": "battery",
  "CAA - PNEU - GYRO": "tube",
  "Carte Mère - GYRO": "electronics",
  "Coque - Trolley - GB - GYRO": "protection",
  "Eclairage LED - Bandeau - GYRO": "lights",
  "Moteur - Roulement - GYRO": "motor",
  "Pad - GYRO": "foot",
  "Pédale - Sup - GYRO": "deck",
  "Consommable": "sealer",
};

const MOTS_CLES: [RegExp, Icone][] = [
  [/chambre\s*(à|a)\s*air|\bcaa\b/i, "chambre_air"],
  [/valve/i, "valve"],
  [/pneu|tubeless/i, "tire"],
  [/plaquette/i, "pads"],
  [/disque/i, "disc"],
  [/étrier|etrier/i, "caliper"],
  [/levier/i, "lever"],
  [/garde[-\s]?boue/i, "mudguard"],
  [/accélérateur|accelerateur|gâchette|gachette/i, "throttle"],
  [/contrôleur|controleur/i, "controller"],
  [/moteur/i, "motor"],
  [/batterie/i, "battery"],
  [/chargeur/i, "charger"],
  [/écran|ecran|display|dashboard/i, "display"],
  [/feu|phare|lumière|lumiere|éclairage|eclairage/i, "lights"],
  [/clignotant|réflecteur|reflecteur|catadioptre/i, "reflector"],
  [/roulement/i, "bearing"],
  [/jante|roue/i, "wheel"],
  [/amortisseur|suspension|ressort/i, "suspension"],
  [/béquille|bequille/i, "kickstand"],
  [/poignée|poignee|grip/i, "handlebar_grip"],
  [/guidon/i, "handlebar"],
  [/potence/i, "stem"],
  [/sonnette|klaxon/i, "horn"],
  [/vis\b|écrou|ecrou|boulon/i, "screw"],
  [/câble|cable|faisceau/i, "cables"],
  [/selle/i, "seat"],
  [/comodo|commande/i, "comodo"],
];

export function iconeArticle(designation: string | null | undefined, categorie: string | null | undefined): Icone | null {
  const texte = designation ?? "";
  for (const [motif, icone] of MOTS_CLES) {
    if (motif.test(texte)) return icone;
  }
  return categorie ? (ICONES_PAR_DEFAUT[categorie] ?? null) : null;
}

const CLE_STOCKAGE = "caisse_icones_categories";

export function lireIconesChoisies(): Record<string, Icone> {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return {};
    const valeurs = JSON.parse(brut) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(valeurs).filter((e): e is [string, Icone] => (ICONES as readonly string[]).includes(e[1])),
    );
  } catch {
    return {};
  }
}

export function enregistrerIconesChoisies(icones: Record<string, Icone>) {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(icones));
  } catch {}
}
