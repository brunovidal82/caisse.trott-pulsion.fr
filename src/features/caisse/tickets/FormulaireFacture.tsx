"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Modale } from "@/features/caisse/vente/Modale";
import { URL_FORMULAIREDB } from "@/lib/caisse/boutique";
import { numeroTicket } from "@/lib/caisse/panier";
import { euros } from "@/lib/format";
import { RechercheClient } from "@/features/caisse/clients/RechercheClient";
import type { TicketDetail } from "./actions";
import { clientPourFacture, creerFacture, type ClientFacture, type ResultatFacture } from "./facture-actions";

type Props = {
  ticket: TicketDetail;
  onFermer: () => void;
  onTermine: () => Promise<void>;
};

const VIDE: ClientFacture = { type: "individual", prenom: "", nom: "", adresse: "", telephone: "", email: "", siren: "", tva: "" };

export function FormulaireFacture({ ticket, onFermer, onTermine }: Props) {
  const [client, setClient] = useState<ClientFacture>(VIDE);
  const [pret, setPret] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Extract<ResultatFacture, { ok: true }> | null>(null);

  useEffect(() => {
    let annule = false;
    clientPourFacture(ticket.id)
      .then((c) => {
        if (!annule) {
          setClient(c);
          setPret(true);
        }
      })
      .catch(() => {
        if (!annule) setPret(true);
      });
    return () => {
      annule = true;
    };
  }, [ticket.id]);

  const pro = client.type === "business";
  const changer = (champ: keyof ClientFacture) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setClient((c) => ({ ...c, [champ]: e.target.value }));

  async function valider() {
    setEnCours(true);
    setErreur(null);
    const r = await creerFacture(ticket.id, client);
    setEnCours(false);
    if (!r.ok) return setErreur(r.erreur);
    setResultat(r);
  }

  if (resultat) {
    return (
      <Modale titre="Facture créée">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <div>
            <b className="text-lg">Facture {resultat.numero}</b>
            <div className="text-sm text-muted-foreground">
              pour {numeroTicket(ticket.numero)} · {euros(ticket.totalTtc)}
            </div>
          </div>
        </div>
        {resultat.avertissement ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{resultat.avertissement}</p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          Elle est numérotée à la suite de tes factures FormulaireDB. Pour l&apos;imprimer ou l&apos;envoyer en PDF,
          ouvre-la dans FormulaireDB.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={`${URL_FORMULAIREDB}/factures/${resultat.invoiceId}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold"
            style={{ backgroundColor: "#0F172A", color: "#FFFFFF" }}
          >
            <ExternalLink className="size-5" />
            Ouvrir dans FormulaireDB
          </a>
          <button
            type="button"
            onClick={onTermine}
            className="h-12 rounded-xl border border-border text-base font-semibold hover:bg-muted"
          >
            Terminé
          </button>
        </div>
      </Modale>
    );
  }

  const champ = "h-11 rounded-xl border border-border px-3 text-base";

  return (
    <Modale titre={`Facture pour ${numeroTicket(ticket.numero)}`} onFermer={enCours ? undefined : onFermer} largeur="max-w-xl">
      {!pret ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <RechercheClient
            placeholder="Client déjà connu ? Nom ou téléphone"
            onChoisir={(c) =>
              setClient({
                type: c.type,
                prenom: c.prenom,
                nom: c.nom,
                adresse: c.adresse,
                telephone: c.telephone,
                email: c.email,
                siren: c.siren,
                tva: c.tva,
              })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["individual", "Particulier"],
                ["business", "Professionnel"],
              ] as const
            ).map(([valeur, libelle]) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setClient((c) => ({ ...c, type: valeur }))}
                className="h-11 rounded-xl border text-sm font-semibold"
                style={client.type === valeur ? { borderWidth: 2, borderColor: "#0F172A", backgroundColor: "#F8FAFC" } : undefined}
              >
                {libelle}
              </button>
            ))}
          </div>

          {pro ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Raison sociale *
              <input value={client.nom} onChange={changer("nom")} className={champ} autoFocus />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Prénom
                <input value={client.prenom} onChange={changer("prenom")} className={champ} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Nom *
                <input value={client.nom} onChange={changer("nom")} className={champ} />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Adresse {pro ? "*" : ""}
            <input value={client.adresse} onChange={changer("adresse")} placeholder="N°, rue, code postal, ville" className={champ} />
          </label>

          {pro ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                SIREN *
                <input value={client.siren} onChange={changer("siren")} inputMode="numeric" className={champ} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                N° TVA intracommunautaire
                <input value={client.tva} onChange={changer("tva")} className={champ} />
              </label>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Téléphone
              <input value={client.telephone} onChange={changer("telephone")} inputMode="tel" className={champ} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              E-mail
              <input value={client.email} onChange={changer("email")} inputMode="email" className={champ} />
            </label>
          </div>

          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
            Crée une facture validée avec les articles du ticket, numérotée à la suite de tes factures. Les règlements du ticket sont reportés : elle sera « acquittée ». Le stock n&apos;est pas
            touché une deuxième fois.
          </p>

          {erreur ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erreur}</p> : null}

          <button
            type="button"
            disabled={enCours || !client.nom.trim()}
            onClick={valider}
            className="h-14 rounded-xl text-base font-semibold"
            style={{ backgroundColor: "#0F172A", color: "#FFFFFF", opacity: enCours || !client.nom.trim() ? 0.4 : 1 }}
          >
            {enCours ? "Création…" : "Créer la facture"}
          </button>
        </div>
      )}
    </Modale>
  );
}
