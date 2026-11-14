"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { euros, lireMontant } from "@/lib/format";
import {
  billetsRapides,
  enCentimes,
  renduMonnaie,
  resteAPayer,
  totalPaiements,
  type Paiement,
} from "@/lib/caisse/panier";
import { verifierAvoir, type AvoirInfo } from "./actions";
import { Modale } from "./Modale";

export type Moyen = Paiement["moyen"];

const MOYENS: { id: Moyen; libelle: string }[] = [
  { id: "cb", libelle: "CB" },
  { id: "especes", libelle: "Espèces" },
  { id: "virement", libelle: "Virement" },
  { id: "avoir", libelle: "Avoir" },
];

const LIBELLES: Record<Moyen, string> = {
  cb: "CB",
  especes: "Espèces",
  virement: "Virement",
  avoir: "Avoir",
};

type Props = {
  aPayer: number;
  moyenInitial: Moyen;
  onAnnuler: () => void;
  onValider: (paiements: Paiement[]) => Promise<string | null>;
};

export function Encaissement({ aPayer, moyenInitial, onAnnuler, onValider }: Props) {
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [moyen, setMoyen] = useState<Moyen>(moyenInitial);
  const [montant, setMontant] = useState(aPayer.toFixed(2).replace(".", ","));
  const [recu, setRecu] = useState("");
  const [avoirNumero, setAvoirNumero] = useState("");
  const [avoir, setAvoir] = useState<AvoirInfo | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const reste = resteAPayer(aPayer, paiements);
  const montantSaisi = lireMontant(montant);
  const recuSaisi = lireMontant(recu);
  const avoirDejaUtilise = paiements.some((p) => p.moyen === "avoir");

  function choisirMoyen(m: Moyen) {
    setMoyen(m);
    setMontant(reste.toFixed(2).replace(".", ","));
    setRecu("");
    setAvoir(null);
    setAvoirNumero("");
    setErreur(null);
  }

  async function enregistrer(liste: Paiement[]) {
    setEnCours(true);
    setErreur(null);
    const message = await onValider(liste);
    if (message) {
      setErreur(message);
      setEnCours(false);
    }
  }

  async function ajouter(paiement: Paiement) {
    if (enCentimes(paiement.montant) <= 0) return setErreur("Montant invalide.");
    if (enCentimes(paiement.montant) > enCentimes(reste)) {
      return setErreur(`Le montant dépasse le reste à payer (${euros(reste)}).`);
    }
    const liste = [...paiements, paiement];
    setPaiements(liste);
    setErreur(null);
    if (enCentimes(resteAPayer(aPayer, liste)) === 0) {
      await enregistrer(liste);
      return;
    }
    const nouveauReste = resteAPayer(aPayer, liste);
    setMontant(nouveauReste.toFixed(2).replace(".", ","));
    setRecu("");
    setAvoir(null);
    setAvoirNumero("");
  }

  async function chercherAvoir() {
    setErreur(null);
    setAvoir(null);
    if (!avoirNumero.trim()) return;
    try {
      setAvoir(await verifierAvoir(avoirNumero));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Vérification impossible.");
    }
  }

  const soldeComplet = montantSaisi !== null && enCentimes(montantSaisi) === enCentimes(reste);
  const suffixe = soldeComplet ? " et enregistrer" : "";

  return (
    <Modale titre="Encaissement" onFermer={enCours ? undefined : onAnnuler} largeur="max-w-xl">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <div>
          <div className="text-xs text-muted-foreground">À payer</div>
          <div className="text-lg font-bold tabular-nums">{euros(aPayer)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Déjà réglé</div>
          <div className="text-lg font-bold tabular-nums">{euros(totalPaiements(paiements))}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Reste</div>
          <div className="text-lg font-bold text-[#9f360a] tabular-nums">{euros(reste)}</div>
        </div>
      </div>

      {paiements.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {paiements.map((p, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-semibold">{LIBELLES[p.moyen]}</span>
              {p.avoirNumero ? <span className="text-muted-foreground">{p.avoirNumero}</span> : null}
              {p.especesRecues !== undefined ? (
                <span className="text-muted-foreground">reçu {euros(p.especesRecues)}</span>
              ) : null}
              <span className="ml-auto font-semibold tabular-nums">{euros(p.montant)}</span>
              <button
                type="button"
                disabled={enCours}
                onClick={() => setPaiements(paiements.filter((_, j) => j !== i))}
                className="flex size-7 items-center justify-center rounded-lg hover:bg-muted"
                aria-label="Retirer ce paiement"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {enCentimes(reste) > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {MOYENS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={enCours || (m.id === "avoir" && avoirDejaUtilise)}
                onClick={() => choisirMoyen(m.id)}
                className={`h-12 rounded-xl border text-sm font-semibold disabled:opacity-40 ${
                  moyen === m.id ? "border-2 border-[#0F172A] bg-slate-50" : "border-border bg-white"
                }`}
              >
                {m.libelle}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {moyen !== "avoir" ? (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Montant {moyen === "especes" ? "à régler en espèces" : `en ${LIBELLES[moyen]}`}
                <input
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  inputMode="decimal"
                  className="h-12 rounded-xl border border-border px-3 text-lg tabular-nums"
                />
              </label>
            ) : null}

            {moyen === "cb" ? (
              <>
                <p className="rounded-xl bg-[#FFF7ED] px-3 py-2 text-sm text-[#7a2500]">
                  Tape {montantSaisi !== null ? euros(montantSaisi) : "le montant"} sur le terminal et attends
                  l&apos;accord avant de valider.
                </p>
                <button
                  type="button"
                  disabled={enCours || montantSaisi === null}
                  onClick={() => montantSaisi !== null && ajouter({ moyen: "cb", montant: montantSaisi })}
                  className="h-14 rounded-xl bg-[#0F172A] text-base font-semibold text-white disabled:opacity-40"
                >
                  Paiement CB accepté{suffixe}
                </button>
              </>
            ) : null}

            {moyen === "virement" ? (
              <button
                type="button"
                disabled={enCours || montantSaisi === null}
                onClick={() => montantSaisi !== null && ajouter({ moyen: "virement", montant: montantSaisi })}
                className="h-14 rounded-xl bg-[#0F172A] text-base font-semibold text-white disabled:opacity-40"
              >
                Virement reçu{suffixe}
              </button>
            ) : null}

            {moyen === "especes" ? (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Donné par le client
                  <input
                    value={recu}
                    onChange={(e) => setRecu(e.target.value)}
                    inputMode="decimal"
                    placeholder={montantSaisi !== null ? montantSaisi.toFixed(2).replace(".", ",") : ""}
                    className="h-12 rounded-xl border border-border px-3 text-lg tabular-nums"
                  />
                </label>
                {montantSaisi !== null ? (
                  <div className="grid grid-cols-4 gap-2">
                    {billetsRapides(montantSaisi).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setRecu(b.toFixed(2).replace(".", ","))}
                        className="h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                      >
                        {euros(b)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {montantSaisi !== null && recuSaisi !== null && recuSaisi >= montantSaisi ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
                    <span className="font-medium">À rendre</span>
                    <b className="text-2xl tabular-nums">
                      {euros((enCentimes(recuSaisi) - enCentimes(montantSaisi)) / 100)}
                    </b>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={
                    enCours ||
                    montantSaisi === null ||
                    (recuSaisi !== null && recuSaisi < montantSaisi)
                  }
                  onClick={() =>
                    montantSaisi !== null &&
                    ajouter({
                      moyen: "especes",
                      montant: montantSaisi,
                      especesRecues: recuSaisi ?? montantSaisi,
                    })
                  }
                  className="h-14 rounded-xl bg-[#0F172A] text-base font-semibold text-white disabled:opacity-40"
                >
                  Valider les espèces{suffixe}
                </button>
              </>
            ) : null}

            {moyen === "avoir" ? (
              <>
                <div className="flex gap-2">
                  <input
                    value={avoirNumero}
                    onChange={(e) => setAvoirNumero(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        chercherAvoir();
                      }
                    }}
                    placeholder="AV-0001"
                    className="h-12 flex-1 rounded-xl border border-border px-3 text-lg uppercase"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={chercherAvoir}
                    className="h-12 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
                  >
                    Vérifier
                  </button>
                </div>
                {avoir ? <CarteAvoir avoir={avoir} reste={reste} /> : null}
                {avoir?.statut === "valide" && avoir.montant !== undefined ? (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() =>
                      ajouter({
                        moyen: "avoir",
                        montant: Math.min(avoir.montant as number, reste),
                        avoirNumero: avoir.numero,
                      })
                    }
                    className="h-14 rounded-xl bg-[#0F172A] text-base font-semibold text-white disabled:opacity-40"
                  >
                    Utiliser {euros(Math.min(avoir.montant, reste))} de l&apos;avoir
                    {enCentimes(avoir.montant) >= enCentimes(reste) ? " et enregistrer" : ""}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {renduMonnaie(paiements) > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">
              <span className="font-medium">À rendre</span>
              <b className="text-2xl tabular-nums">{euros(renduMonnaie(paiements))}</b>
            </div>
          ) : null}
          <button
            type="button"
            disabled={enCours}
            onClick={() => enregistrer(paiements)}
            className="h-14 rounded-xl bg-[#0F172A] text-base font-semibold text-white disabled:opacity-40"
          >
            {enCours ? "Enregistrement…" : "Enregistrer la vente"}
          </button>
        </div>
      )}

      {enCours ? <p className="mt-3 text-center text-sm text-muted-foreground">Enregistrement…</p> : null}
      {erreur ? (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p>
      ) : null}
    </Modale>
  );
}

function CarteAvoir({ avoir, reste }: { avoir: AvoirInfo; reste: number }) {
  if (avoir.statut === "introuvable") {
    return <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">Avoir introuvable.</p>;
  }
  if (avoir.statut === "utilise") {
    return (
      <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
        L&apos;avoir {avoir.numero} a déjà été utilisé.
      </p>
    );
  }
  if (avoir.statut === "expire") {
    return (
      <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
        L&apos;avoir {avoir.numero} a expiré le{" "}
        {avoir.expire_le ? new Date(avoir.expire_le).toLocaleDateString("fr-FR") : "?"}.
      </p>
    );
  }
  const montant = avoir.montant ?? 0;
  const perdu = (enCentimes(montant) - enCentimes(reste)) / 100;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
      <div className="flex justify-between">
        <span>
          Avoir <b>{avoir.numero}</b>
          {avoir.client_nom ? ` · ${avoir.client_nom}` : ""}
        </span>
        <b className="tabular-nums">{euros(montant)}</b>
      </div>
      <span className="text-muted-foreground">
        Valable jusqu&apos;au {avoir.expire_le ? new Date(avoir.expire_le).toLocaleDateString("fr-FR") : "?"}
      </span>
      {perdu > 0 ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          L&apos;avoir s&apos;utilise en une seule fois : les {euros(perdu)} restants seront perdus. Préviens le
          client ou ajoute un article.
        </p>
      ) : null}
    </div>
  );
}
