"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ouvrirJournee, type EtatFormulaire } from "@/features/caisse/actions";

export function OuvrirJournee() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    ouvrirJournee,
    {},
  );

  return (
    <form
      action={action}
      className="mx-auto mt-10 flex max-w-sm flex-col gap-4 rounded-2xl border border-border bg-white p-8"
    >
      <div>
        <h2 className="text-lg font-bold">Ouvrir la journée</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compte les espèces dans la caisse avant de commencer.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fond">Fond de caisse (€)</Label>
        <Input
          id="fond"
          name="fond"
          inputMode="decimal"
          autoComplete="off"
          placeholder="150,00"
          required
          autoFocus
          className="h-11 text-lg"
        />
      </div>
      {etat.erreur ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {etat.erreur}
        </p>
      ) : null}
      <Button type="submit" disabled={enCours} className="h-11" size="lg">
        {enCours ? "Ouverture…" : "Ouvrir la journée"}
      </Button>
    </form>
  );
}
