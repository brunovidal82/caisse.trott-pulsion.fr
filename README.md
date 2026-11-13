# Caisse Trott Pulsion

Caisse de la boutique (ventes, dossiers atelier, acomptes, annulations, avoirs, clôtures).

- Next.js 16, Supabase (base FormulaireDB, schéma `caisse`)
- Domaine : caisse.trott-pulsion.fr (Vercel, équipe BV Projets, projet `tp-caisse`)

## Démarrer

1. `pnpm install`
2. Copier `.env.example` vers `.env.local` et coller la clé anon de FormulaireDB
3. Exécuter `supabase/migrations/20261113190000_caisse.sql` dans le SQL Editor de FormulaireDB
4. Supabase → Project Settings → Data API → Exposed schemas : ajouter `caisse`
5. Créer les vendeurs : `select caisse.creer_vendeur('Prénom', 'admin', '1234');`
6. `pnpm dev` puis http://localhost:3002

## Règles

- Les tickets, paiements, clôtures et le journal ne peuvent être ni modifiés ni supprimés (triggers).
- Toutes les écritures passent par les fonctions `caisse.*` (security definer).
- Tant que fiskaltrust n'est pas branché, les tickets portent la mention « mode test ».
