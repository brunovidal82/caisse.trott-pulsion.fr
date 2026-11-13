"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const MESSAGES: Record<string, string> = {
  unauthorized: "Accès refusé : ce compte n'est pas autorisé sur la caisse.",
  config:
    "La caisse n'est pas encore installée dans Supabase (migration non exécutée ou schéma « caisse » non exposé).",
};

function messageConnexion(message: string) {
  const texte = message.toLowerCase();
  if (texte.includes("invalid login") || texte.includes("invalid credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (texte.includes("failed to fetch") || texte.includes("network")) {
    return "Impossible de joindre Supabase. Vérifie la connexion internet.";
  }
  return message || "Connexion impossible.";
}

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    MESSAGES[searchParams.get("error") ?? ""] ?? null,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Configuration Supabase incomplète. Vérifie .env.local.");
      }
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw new Error(messageConnexion(authError.message));

      const { data: autorise, error: accesError } = await supabase
        .schema("caisse")
        .rpc("est_vendeur");
      if (accesError) throw new Error(MESSAGES.config);
      if (!autorise) {
        await supabase.auth.signOut();
        throw new Error(MESSAGES.unauthorized);
      }

      router.replace("/vendeur");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo-trott-pulsion.webp"
            alt="Trott Pulsion"
            width={96}
            height={64}
            className="h-12 w-auto object-contain"
            priority
          />
          <p className="text-brand-gradient mt-3 font-brand text-xl tracking-wide">
            TROTT PULSION
          </p>
          <h1 className="mt-6 text-xl font-bold tracking-tight">Caisse</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connexion avec le compte de la boutique
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={loading} className="h-10 w-full" size="lg">
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
