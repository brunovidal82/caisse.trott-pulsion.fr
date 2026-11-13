create schema if not exists caisse;
create extension if not exists pgcrypto with schema extensions;

create table caisse.vendeurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete restrict,
  prenom text not null,
  role text not null check (role in ('admin', 'vendeur')),
  pin_hash text not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table caisse.sessions (
  id uuid primary key default gen_random_uuid(),
  vendeur_id uuid not null references caisse.vendeurs (id),
  ouverte_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '12 hours',
  fermee_le timestamptz
);

create table caisse.compteurs (
  nom text primary key check (nom in ('ticket', 'journee', 'avoir')),
  valeur bigint not null default 0
);

insert into caisse.compteurs (nom) values ('ticket'), ('journee'), ('avoir');

create table caisse.journees (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique,
  ouverte_le timestamptz not null default now(),
  ouverte_par uuid not null references caisse.vendeurs (id),
  fond_ouverture numeric(12, 2) not null check (fond_ouverture >= 0)
);

create table caisse.tickets (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique,
  journee_id uuid not null references caisse.journees (id),
  type text not null check (type in ('vente', 'annulation', 'acompte')),
  ticket_origine_id uuid references caisse.tickets (id),
  motif text,
  vendeur_id uuid not null references caisse.vendeurs (id),
  client_id text,
  client_nom text,
  dossier_id bigint,
  total_ht numeric(12, 2) not null,
  total_tva numeric(12, 2) not null,
  total_ttc numeric(12, 2) not null,
  mode_test boolean not null default true,
  cree_le timestamptz not null default now(),
  check (type <> 'annulation' or (ticket_origine_id is not null and motif is not null and length(trim(motif)) > 0)),
  check (type <> 'acompte' or dossier_id is not null)
);

create table caisse.lignes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references caisse.tickets (id),
  ordre int not null,
  type text not null check (type in ('produit', 'main_oeuvre', 'divers', 'acompte_deduit')),
  produit_id bigint references public.products (id),
  code text,
  designation text not null,
  quantite numeric(12, 3) not null,
  prix_unitaire_ttc numeric(12, 2) not null,
  remise_ttc numeric(12, 2) not null default 0,
  taux_tva numeric(5, 2) not null,
  total_ht numeric(12, 2) not null,
  total_tva numeric(12, 2) not null,
  total_ttc numeric(12, 2) not null,
  ligne_origine_id uuid references caisse.lignes (id),
  acompte_ticket_id uuid references caisse.tickets (id),
  unique (ticket_id, ordre)
);

create unique index lignes_acompte_utilise_une_fois
  on caisse.lignes (acompte_ticket_id) where type = 'acompte_deduit';

create table caisse.avoirs (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  montant numeric(12, 2) not null check (montant > 0),
  client_id text,
  client_nom text,
  emis_par_ticket_id uuid not null references caisse.tickets (id),
  emis_le timestamptz not null default now(),
  expire_le timestamptz not null
);

create table caisse.paiements (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references caisse.tickets (id),
  moyen text not null check (moyen in ('cb', 'especes', 'virement', 'avoir')),
  montant numeric(12, 2) not null check (montant <> 0),
  especes_recues numeric(12, 2),
  rendu numeric(12, 2),
  avoir_id uuid references caisse.avoirs (id),
  check (moyen <> 'avoir' or avoir_id is not null)
);

create unique index paiements_avoir_utilise_une_fois
  on caisse.paiements (avoir_id) where moyen = 'avoir' and montant > 0;

create table caisse.clotures (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('jour', 'mois', 'an')),
  periode text not null,
  journee_id uuid references caisse.journees (id),
  nb_tickets int not null,
  total_ht numeric(14, 2) not null,
  total_tva numeric(14, 2) not null,
  total_ttc numeric(14, 2) not null,
  detail_tva jsonb not null,
  detail_moyens jsonb not null,
  grand_total_perpetuel numeric(16, 2) not null,
  especes_attendues numeric(12, 2),
  especes_comptees numeric(12, 2),
  ecart numeric(12, 2),
  fond_laisse numeric(12, 2),
  remise_banque numeric(12, 2),
  cree_le timestamptz not null default now(),
  cree_par uuid not null references caisse.vendeurs (id),
  unique (type, periode),
  check (type <> 'jour' or journee_id is not null)
);

create table caisse.signatures (
  id uuid primary key default gen_random_uuid(),
  cible text not null check (cible in ('ticket', 'cloture')),
  cible_id uuid not null,
  reponse jsonb not null,
  signe_le timestamptz not null default now(),
  unique (cible, cible_id)
);

create table caisse.factures (
  ticket_id uuid primary key references caisse.tickets (id),
  invoice_id uuid not null unique references public.invoices (id),
  cree_le timestamptz not null default now()
);

create table caisse.journal (
  id uuid primary key default gen_random_uuid(),
  quand timestamptz not null default now(),
  vendeur_id uuid references caisse.vendeurs (id),
  evenement text not null check (evenement in (
    'connexion', 'deconnexion', 'pin_refuse', 'ouverture', 'cloture', 'vente', 'annulation',
    'acompte', 'avoir_emis', 'avoir_utilise', 'duplicata', 'facture', 'erreur_signature'
  )),
  cible_id uuid,
  details jsonb
);

create or replace function caisse.interdire_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Caisse : les enregistrements ne peuvent être ni modifiés ni supprimés (table %)', tg_table_name;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['journees', 'tickets', 'lignes', 'avoirs', 'paiements', 'clotures', 'signatures', 'factures', 'journal']
  loop
    execute format(
      'create trigger %I before update or delete on caisse.%I for each row execute function caisse.interdire_modification()',
      t || '_lecture_seule', t
    );
  end loop;
end;
$$;

create or replace function caisse.est_vendeur()
returns boolean
language sql
stable
security definer
set search_path = caisse, public
as $$
  select public.is_site_admin() or exists (
    select 1 from caisse.vendeurs v where v.user_id = auth.uid() and v.actif
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['vendeurs', 'sessions', 'compteurs', 'journees', 'tickets', 'lignes', 'avoirs', 'paiements', 'clotures', 'signatures', 'factures', 'journal']
  loop
    execute format('alter table caisse.%I enable row level security', t);
    execute format(
      'create policy %I on caisse.%I for select to authenticated using (caisse.est_vendeur())',
      t || '_lecture', t
    );
  end loop;
end;
$$;

grant usage on schema caisse to authenticated;
grant select on all tables in schema caisse to authenticated;

alter table public.mouvements_stock
  drop constraint if exists mouvements_stock_source_check;

alter table public.mouvements_stock
  add constraint mouvements_stock_source_check
    check (source in ('BL', 'HIBOUTIK', 'BBE', 'INVENTAIRE', 'MANUEL', 'CAISSE'));

do $$
declare
  v_def text;
  v_ancre text := E'  RAISE EXCEPTION ''Combinaison type_mouvement/source invalide: % / %'',';
  v_ajout text := E'  IF NEW.source = ''CAISSE'' AND NEW.type_mouvement IN (''VENTE'', ''AJUSTEMENT'') THEN\n'
    || E'    IF NEW.produit_id IS NULL OR NEW.quantite <= 0 THEN\n'
    || E'      RAISE EXCEPTION ''Mouvement caisse invalide'' USING ERRCODE = ''23514'';\n'
    || E'    END IF;\n'
    || E'    SELECT ticket_id INTO v_parent FROM caisse.lignes WHERE id = NEW.source_ligne_id;\n'
    || E'    IF v_parent IS NULL OR v_parent IS DISTINCT FROM NEW.source_id THEN\n'
    || E'      RAISE EXCEPTION ''Ligne de ticket caisse introuvable'' USING ERRCODE = ''23503'';\n'
    || E'    END IF;\n'
    || E'    RETURN NEW;\n'
    || E'  END IF;\n\n';
begin
  select pg_get_functiondef('public.validate_mouvement_stock_source()'::regprocedure) into v_def;
  if position(v_ancre in v_def) = 0 then
    raise exception 'Fonction validate_mouvement_stock_source inattendue, adaptation manuelle nécessaire';
  end if;
  if position('CAISSE' in v_def) = 0 then
    execute replace(v_def, v_ancre, v_ajout || v_ancre);
  end if;
end;
$$;

create or replace function caisse._vendeur(p_session uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid;
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  select s.vendeur_id into v_vendeur
  from caisse.sessions s
  join caisse.vendeurs v on v.id = s.vendeur_id
  where s.id = p_session and s.fermee_le is null and s.expire_le > now() and v.actif;
  if v_vendeur is null then
    raise exception 'Session vendeur expirée, reconnecte-toi';
  end if;
  return v_vendeur;
end;
$$;

create or replace function caisse._numero(p_nom text)
returns bigint
language sql
security definer
set search_path = caisse, public
as $$
  update caisse.compteurs set valeur = valeur + 1 where nom = p_nom returning valeur;
$$;

create or replace function caisse._journee_ouverte()
returns uuid
language sql
stable
security definer
set search_path = caisse, public
as $$
  select j.id
  from caisse.journees j
  where not exists (select 1 from caisse.clotures c where c.journee_id = j.id and c.type = 'jour')
  order by j.numero desc
  limit 1;
$$;

create or replace function caisse.journee_ouverte()
returns jsonb
language plpgsql
stable
security definer
set search_path = caisse, public
as $$
declare
  v_id uuid;
  v_res jsonb;
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  v_id := caisse._journee_ouverte();
  if v_id is null then
    return null;
  end if;
  select jsonb_build_object(
    'id', j.id,
    'numero', j.numero,
    'ouverte_le', j.ouverte_le,
    'ouverte_par', v.prenom,
    'fond_ouverture', j.fond_ouverture,
    'nb_tickets', (select count(*) from caisse.tickets t where t.journee_id = j.id),
    'total_ttc', (select coalesce(sum(t.total_ttc), 0) from caisse.tickets t where t.journee_id = j.id)
  ) into v_res
  from caisse.journees j
  join caisse.vendeurs v on v.id = j.ouverte_par
  where j.id = v_id;
  return v_res;
end;
$$;

create or replace function caisse.creer_vendeur(p_prenom text, p_role text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = caisse, public, extensions
as $$
declare
  v_id uuid;
begin
  if not public.is_site_admin() then
    raise exception 'Réservé à l''administrateur';
  end if;
  if coalesce(trim(p_prenom), '') = '' then
    raise exception 'Prénom obligatoire';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'Le code doit faire 4 à 6 chiffres';
  end if;
  insert into caisse.vendeurs (prenom, role, pin_hash)
  values (trim(p_prenom), p_role, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function caisse.changer_pin(p_session uuid, p_ancien text, p_nouveau text)
returns void
language plpgsql
security definer
set search_path = caisse, public, extensions
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_hash text;
begin
  select pin_hash into v_hash from caisse.vendeurs where id = v_vendeur;
  if extensions.crypt(p_ancien, v_hash) <> v_hash then
    raise exception 'Ancien code incorrect';
  end if;
  if p_nouveau is null or p_nouveau !~ '^[0-9]{4,6}$' then
    raise exception 'Le code doit faire 4 à 6 chiffres';
  end if;
  update caisse.vendeurs
  set pin_hash = extensions.crypt(p_nouveau, extensions.gen_salt('bf'))
  where id = v_vendeur;
end;
$$;

create or replace function caisse.connexion(p_vendeur_id uuid, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = caisse, public, extensions
as $$
declare
  v_hash text;
  v_echecs int;
  v_session uuid;
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  select pin_hash into v_hash from caisse.vendeurs where id = p_vendeur_id and actif;
  if v_hash is null then
    raise exception 'Vendeur inconnu ou inactif';
  end if;
  select count(*) into v_echecs
  from caisse.journal
  where vendeur_id = p_vendeur_id
    and evenement = 'pin_refuse'
    and quand > greatest(
      now() - interval '15 minutes',
      coalesce((select max(quand) from caisse.journal where vendeur_id = p_vendeur_id and evenement = 'connexion'), '-infinity')
    );
  if v_echecs >= 5 then
    raise exception 'Trop d''essais, réessaie dans 15 minutes';
  end if;
  if p_pin is null or extensions.crypt(p_pin, v_hash) <> v_hash then
    insert into caisse.journal (vendeur_id, evenement) values (p_vendeur_id, 'pin_refuse');
    return null;
  end if;
  insert into caisse.sessions (vendeur_id) values (p_vendeur_id) returning id into v_session;
  insert into caisse.journal (vendeur_id, evenement, cible_id) values (p_vendeur_id, 'connexion', v_session);
  return v_session;
end;
$$;

create or replace function caisse.deconnexion(p_session uuid)
returns void
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
begin
  update caisse.sessions set fermee_le = now() where id = p_session;
  insert into caisse.journal (vendeur_id, evenement, cible_id) values (v_vendeur, 'deconnexion', p_session);
end;
$$;

create or replace function caisse.ouvrir_journee(p_session uuid, p_fond numeric)
returns uuid
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('caisse.journee'));
  if caisse._journee_ouverte() is not null then
    raise exception 'Une journée est déjà ouverte, clôture-la d''abord';
  end if;
  if p_fond is null or p_fond < 0 then
    raise exception 'Fond de caisse invalide';
  end if;
  insert into caisse.journees (numero, ouverte_par, fond_ouverture)
  values (caisse._numero('journee'), v_vendeur, round(p_fond, 2))
  returning id into v_id;
  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'ouverture', v_id, jsonb_build_object('fond', round(p_fond, 2)));
  return v_id;
end;
$$;

create or replace function caisse._calculer_lignes(p_lignes jsonb)
returns table (
  ordre int,
  type text,
  produit_id bigint,
  code text,
  designation text,
  quantite numeric,
  prix_unitaire_ttc numeric,
  remise_ttc numeric,
  taux_tva numeric,
  total_ht numeric,
  total_tva numeric,
  total_ttc numeric
)
language sql
stable
security definer
set search_path = caisse, public
as $$
  select
    x.ord::int,
    coalesce(x.e->>'type', 'produit'),
    p.id,
    coalesce(nullif(trim(x.e->>'code'), ''), p.code),
    coalesce(nullif(trim(x.e->>'designation'), ''), p.designation),
    v.q,
    v.pu,
    v.rem,
    v.taux,
    round(t.ttc / (1 + v.taux / 100), 2),
    t.ttc - round(t.ttc / (1 + v.taux / 100), 2),
    t.ttc
  from jsonb_array_elements(p_lignes) with ordinality as x(e, ord)
  left join public.products p on p.id = (x.e->>'produit_id')::bigint
  cross join lateral (
    select
      round((x.e->>'quantite')::numeric, 3) as q,
      round((x.e->>'prix_unitaire_ttc')::numeric, 2) as pu,
      round(coalesce((x.e->>'remise_ttc')::numeric, 0), 2) as rem,
      coalesce((x.e->>'taux_tva')::numeric, p.vat_rate, 20) as taux
  ) v
  cross join lateral (select round(v.q * v.pu - v.rem, 2) as ttc) t;
$$;

create or replace function caisse._verifier_lignes(p_lignes jsonb)
returns void
language plpgsql
stable
security definer
set search_path = caisse, public
as $$
declare
  l record;
begin
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Le ticket ne contient aucune ligne';
  end if;
  for l in
    select c.*, (e->>'produit_id') as produit_demande
    from caisse._calculer_lignes(p_lignes) c
    join jsonb_array_elements(p_lignes) with ordinality as x(e, ord) on x.ord = c.ordre
  loop
    if l.type not in ('produit', 'main_oeuvre', 'divers') then
      raise exception 'Ligne % : type invalide', l.ordre;
    end if;
    if l.produit_demande is not null and l.produit_id is null then
      raise exception 'Ligne % : produit introuvable', l.ordre;
    end if;
    if l.designation is null then
      raise exception 'Ligne % : désignation manquante', l.ordre;
    end if;
    if l.quantite is null or l.quantite <= 0 then
      raise exception 'Ligne % : quantité invalide', l.ordre;
    end if;
    if l.prix_unitaire_ttc is null or l.prix_unitaire_ttc < 0 then
      raise exception 'Ligne % : prix invalide', l.ordre;
    end if;
    if l.remise_ttc < 0 or l.remise_ttc > round(l.quantite * l.prix_unitaire_ttc, 2) then
      raise exception 'Ligne % : remise invalide', l.ordre;
    end if;
    if l.taux_tva not in (0, 2.1, 5.5, 10, 20) then
      raise exception 'Ligne % : taux de TVA invalide (%)', l.ordre, l.taux_tva;
    end if;
  end loop;
end;
$$;

create or replace function caisse._enregistrer_paiements(p_vendeur uuid, p_ticket uuid, p_total numeric, p_paiements jsonb)
returns numeric
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  p jsonb;
  v_moyen text;
  v_montant numeric(12, 2);
  v_recu numeric(12, 2);
  v_somme numeric(12, 2) := 0;
  v_rendu numeric(12, 2) := 0;
  v_avoir caisse.avoirs%rowtype;
begin
  if p_paiements is null or jsonb_typeof(p_paiements) <> 'array' or jsonb_array_length(p_paiements) = 0 then
    if p_total = 0 then
      return 0;
    end if;
    raise exception 'Aucun paiement';
  end if;
  for p in select * from jsonb_array_elements(p_paiements)
  loop
    v_moyen := p->>'moyen';
    v_montant := round((p->>'montant')::numeric, 2);
    if v_montant is null or v_montant <= 0 then
      raise exception 'Montant de paiement invalide';
    end if;
    if v_moyen = 'especes' then
      v_recu := coalesce(round((p->>'especes_recues')::numeric, 2), v_montant);
      if v_recu < v_montant then
        raise exception 'Espèces reçues insuffisantes';
      end if;
      insert into caisse.paiements (ticket_id, moyen, montant, especes_recues, rendu)
      values (p_ticket, 'especes', v_montant, v_recu, v_recu - v_montant);
      v_rendu := v_rendu + (v_recu - v_montant);
    elsif v_moyen in ('cb', 'virement') then
      insert into caisse.paiements (ticket_id, moyen, montant)
      values (p_ticket, v_moyen, v_montant);
    elsif v_moyen = 'avoir' then
      select * into v_avoir from caisse.avoirs where numero = upper(trim(p->>'avoir_numero')) for update;
      if not found then
        raise exception 'Avoir introuvable';
      end if;
      if v_avoir.expire_le < now() then
        raise exception 'Avoir % expiré depuis le %', v_avoir.numero, to_char(v_avoir.expire_le, 'DD/MM/YYYY');
      end if;
      if exists (select 1 from caisse.paiements where avoir_id = v_avoir.id and moyen = 'avoir' and montant > 0) then
        raise exception 'Avoir % déjà utilisé', v_avoir.numero;
      end if;
      if v_montant > v_avoir.montant then
        raise exception 'Le paiement dépasse le montant de l''avoir %', v_avoir.numero;
      end if;
      insert into caisse.paiements (ticket_id, moyen, montant, avoir_id)
      values (p_ticket, 'avoir', v_montant, v_avoir.id);
      insert into caisse.journal (vendeur_id, evenement, cible_id, details)
      values (p_vendeur, 'avoir_utilise', v_avoir.id, jsonb_build_object(
        'numero', v_avoir.numero,
        'ticket_id', p_ticket,
        'montant_avoir', v_avoir.montant,
        'utilise', v_montant,
        'perdu', v_avoir.montant - v_montant
      ));
    else
      raise exception 'Moyen de paiement inconnu : %', v_moyen;
    end if;
    v_somme := v_somme + v_montant;
  end loop;
  if v_somme <> p_total then
    raise exception 'Les paiements (% €) ne correspondent pas au total (% €)', v_somme, p_total;
  end if;
  return v_rendu;
end;
$$;

create or replace function caisse.enregistrer_vente(p_session uuid, p_vente jsonb)
returns jsonb
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_journee uuid;
  v_dossier bigint := (p_vente->>'dossier_id')::bigint;
  v_acomptes uuid[] := coalesce(
    (select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_vente->'acomptes', '[]'::jsonb))),
    '{}'
  );
  v_acompte uuid;
  v_ticket uuid;
  v_numero bigint;
  v_ht numeric(12, 2);
  v_tva numeric(12, 2);
  v_ttc numeric(12, 2);
  v_ordre int;
  v_rendu numeric(12, 2);
  l record;
  v_ligne uuid;
begin
  v_journee := caisse._journee_ouverte();
  if v_journee is null then
    raise exception 'Aucune journée ouverte';
  end if;
  perform caisse._verifier_lignes(p_vente->'lignes');

  if v_dossier is not null and not exists (select 1 from public.prise_en_charge where id = v_dossier) then
    raise exception 'Dossier atelier % introuvable', v_dossier;
  end if;

  foreach v_acompte in array v_acomptes
  loop
    if not exists (
      select 1 from caisse.tickets t
      where t.id = v_acompte and t.type = 'acompte' and t.dossier_id is not distinct from v_dossier
    ) then
      raise exception 'Acompte invalide pour ce dossier';
    end if;
    if exists (select 1 from caisse.tickets t where t.ticket_origine_id = v_acompte and t.type = 'annulation') then
      raise exception 'Cet acompte a été remboursé';
    end if;
    if exists (select 1 from caisse.lignes where acompte_ticket_id = v_acompte and type = 'acompte_deduit') then
      raise exception 'Cet acompte a déjà été déduit';
    end if;
  end loop;

  select
    coalesce(sum(c.total_ht), 0) - coalesce((select sum(t.total_ht) from caisse.tickets t where t.id = any (v_acomptes)), 0),
    coalesce(sum(c.total_tva), 0) - coalesce((select sum(t.total_tva) from caisse.tickets t where t.id = any (v_acomptes)), 0),
    coalesce(sum(c.total_ttc), 0) - coalesce((select sum(t.total_ttc) from caisse.tickets t where t.id = any (v_acomptes)), 0)
  into v_ht, v_tva, v_ttc
  from caisse._calculer_lignes(p_vente->'lignes') c;

  if v_ttc < 0 then
    raise exception 'Les acomptes dépassent le montant de la vente';
  end if;

  v_numero := caisse._numero('ticket');
  insert into caisse.tickets (numero, journee_id, type, vendeur_id, client_id, client_nom, dossier_id, total_ht, total_tva, total_ttc)
  values (v_numero, v_journee, 'vente', v_vendeur, p_vente->>'client_id', p_vente->>'client_nom', v_dossier, v_ht, v_tva, v_ttc)
  returning id into v_ticket;

  for l in select * from caisse._calculer_lignes(p_vente->'lignes') order by ordre
  loop
    insert into caisse.lignes (ticket_id, ordre, type, produit_id, code, designation, quantite, prix_unitaire_ttc, remise_ttc, taux_tva, total_ht, total_tva, total_ttc)
    values (v_ticket, l.ordre, l.type, l.produit_id, l.code, l.designation, l.quantite, l.prix_unitaire_ttc, l.remise_ttc, l.taux_tva, l.total_ht, l.total_tva, l.total_ttc)
    returning id into v_ligne;
    if l.type = 'produit' and l.produit_id is not null then
      insert into public.mouvements_stock (produit_id, code_produit, type_mouvement, quantite, source, source_id, source_ligne_id, reference_document, date_document, created_by)
      values (l.produit_id, coalesce(l.code, ''), 'VENTE', l.quantite, 'CAISSE', v_ticket, v_ligne, 'Ticket ' || v_numero, current_date, auth.uid());
    end if;
    v_ordre := l.ordre;
  end loop;

  for l in
    select t.id, t.numero, al.taux_tva, t.total_ht, t.total_tva, t.total_ttc
    from caisse.tickets t
    join caisse.lignes al on al.ticket_id = t.id and al.ordre = 1
    where t.id = any (v_acomptes)
    order by t.numero
  loop
    v_ordre := v_ordre + 1;
    insert into caisse.lignes (ticket_id, ordre, type, designation, quantite, prix_unitaire_ttc, taux_tva, total_ht, total_tva, total_ttc, acompte_ticket_id)
    values (v_ticket, v_ordre, 'acompte_deduit', 'Acompte ticket n°' || l.numero, 1, -l.total_ttc, l.taux_tva, -l.total_ht, -l.total_tva, -l.total_ttc, l.id);
  end loop;

  v_rendu := caisse._enregistrer_paiements(v_vendeur, v_ticket, v_ttc, p_vente->'paiements');

  if v_dossier is not null then
    update public.prise_en_charge set status = 'LIVRE' where id = v_dossier and status is distinct from 'LIVRE';
  end if;

  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'vente', v_ticket, jsonb_build_object('numero', v_numero, 'total_ttc', v_ttc, 'dossier_id', v_dossier));

  return jsonb_build_object('ticket_id', v_ticket, 'numero', v_numero, 'total_ttc', v_ttc, 'rendu', v_rendu);
end;
$$;

create or replace function caisse.enregistrer_acompte(p_session uuid, p_acompte jsonb)
returns jsonb
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_journee uuid := caisse._journee_ouverte();
  v_dossier bigint := (p_acompte->>'dossier_id')::bigint;
  v_ttc numeric(12, 2) := round((p_acompte->>'montant')::numeric, 2);
  v_taux numeric(5, 2) := coalesce((p_acompte->>'taux_tva')::numeric, 20);
  v_ht numeric(12, 2);
  v_ticket uuid;
  v_numero bigint;
  v_rendu numeric(12, 2);
  v_statut text;
begin
  if v_journee is null then
    raise exception 'Aucune journée ouverte';
  end if;
  select status into v_statut from public.prise_en_charge where id = v_dossier;
  if not found then
    raise exception 'Dossier atelier % introuvable', v_dossier;
  end if;
  if v_statut = 'LIVRE' then
    raise exception 'Dossier déjà livré';
  end if;
  if v_ttc is null or v_ttc <= 0 then
    raise exception 'Montant d''acompte invalide';
  end if;
  if v_taux not in (0, 2.1, 5.5, 10, 20) then
    raise exception 'Taux de TVA invalide';
  end if;
  v_ht := round(v_ttc / (1 + v_taux / 100), 2);
  v_numero := caisse._numero('ticket');
  insert into caisse.tickets (numero, journee_id, type, vendeur_id, client_id, client_nom, dossier_id, total_ht, total_tva, total_ttc)
  values (v_numero, v_journee, 'acompte', v_vendeur, p_acompte->>'client_id', p_acompte->>'client_nom', v_dossier, v_ht, v_ttc - v_ht, v_ttc)
  returning id into v_ticket;
  insert into caisse.lignes (ticket_id, ordre, type, designation, quantite, prix_unitaire_ttc, taux_tva, total_ht, total_tva, total_ttc)
  values (v_ticket, 1, 'divers', 'Acompte dossier atelier n°' || v_dossier, 1, v_ttc, v_taux, v_ht, v_ttc - v_ht, v_ttc);
  v_rendu := caisse._enregistrer_paiements(v_vendeur, v_ticket, v_ttc, p_acompte->'paiements');
  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'acompte', v_ticket, jsonb_build_object('numero', v_numero, 'montant', v_ttc, 'dossier_id', v_dossier));
  return jsonb_build_object('ticket_id', v_ticket, 'numero', v_numero, 'total_ttc', v_ttc, 'rendu', v_rendu);
end;
$$;

create or replace function caisse.annuler_ticket(p_session uuid, p_annulation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_journee uuid := caisse._journee_ouverte();
  v_origine caisse.tickets%rowtype;
  v_motif text := nullif(trim(p_annulation->>'motif'), '');
  v_moyen text := p_annulation->>'remboursement';
  v_selection jsonb := p_annulation->'lignes';
  v_ticket uuid;
  v_numero bigint;
  v_ordre int := 0;
  v_ht numeric(12, 2) := 0;
  v_tva numeric(12, 2) := 0;
  v_ttc numeric(12, 2) := 0;
  v_q numeric(12, 3);
  v_deja_q numeric(12, 3);
  v_deja_ttc numeric(12, 2);
  v_l_ttc numeric(12, 2);
  v_l_ht numeric(12, 2);
  v_l_rem numeric(12, 2);
  v_avoir uuid;
  v_avoir_numero text;
  v_ligne uuid;
  o record;
begin
  if v_journee is null then
    raise exception 'Aucune journée ouverte';
  end if;
  if v_motif is null then
    raise exception 'Le motif est obligatoire';
  end if;
  if v_moyen not in ('cb', 'especes', 'avoir') then
    raise exception 'Mode de remboursement invalide';
  end if;
  select * into v_origine from caisse.tickets where id = (p_annulation->>'ticket_id')::uuid for update;
  if not found then
    raise exception 'Ticket introuvable';
  end if;
  if v_origine.type = 'annulation' then
    raise exception 'Un ticket d''annulation ne peut pas être annulé';
  end if;
  if v_origine.type = 'acompte' then
    if exists (select 1 from caisse.lignes where acompte_ticket_id = v_origine.id and type = 'acompte_deduit') then
      raise exception 'Cet acompte a déjà été déduit d''une vente';
    end if;
    if exists (select 1 from caisse.tickets where ticket_origine_id = v_origine.id) then
      raise exception 'Cet acompte a déjà été remboursé';
    end if;
    v_selection := null;
  end if;

  v_numero := caisse._numero('ticket');

  create temporary table if not exists _caisse_annul (
    ligne_id uuid, ordre int, type text, produit_id bigint, code text, designation text,
    quantite numeric, prix_unitaire_ttc numeric, remise_ttc numeric, taux_tva numeric,
    total_ht numeric, total_tva numeric, total_ttc numeric
  ) on commit drop;
  truncate _caisse_annul;

  for o in
    select l.*
    from caisse.lignes l
    where l.ticket_id = v_origine.id and l.type <> 'acompte_deduit'
    order by l.ordre
  loop
    select coalesce(-sum(a.quantite), 0), coalesce(-sum(a.total_ttc), 0)
    into v_deja_q, v_deja_ttc
    from caisse.lignes a
    where a.ligne_origine_id = o.id;

    if v_selection is null then
      v_q := o.quantite - v_deja_q;
    else
      select round((s->>'quantite')::numeric, 3) into v_q
      from jsonb_array_elements(v_selection) s
      where (s->>'ligne_id')::uuid = o.id;
    end if;

    continue when v_q is null or v_q = 0;
    if v_q < 0 or v_q > o.quantite - v_deja_q then
      raise exception 'Ligne « % » : quantité à annuler invalide (reste %)', o.designation, o.quantite - v_deja_q;
    end if;

    if v_q = o.quantite - v_deja_q then
      v_l_ttc := o.total_ttc - v_deja_ttc;
    else
      v_l_ttc := round(o.total_ttc * v_q / o.quantite, 2);
    end if;
    v_l_rem := round(o.remise_ttc * v_q / o.quantite, 2);
    v_l_ht := round(v_l_ttc / (1 + o.taux_tva / 100), 2);
    v_ordre := v_ordre + 1;
    insert into _caisse_annul values (
      o.id, v_ordre, o.type, o.produit_id, o.code, o.designation,
      -v_q, o.prix_unitaire_ttc, -v_l_rem, o.taux_tva,
      -v_l_ht, -(v_l_ttc - v_l_ht), -v_l_ttc
    );
    v_ht := v_ht - v_l_ht;
    v_tva := v_tva - (v_l_ttc - v_l_ht);
    v_ttc := v_ttc - v_l_ttc;
  end loop;

  if v_ordre = 0 then
    raise exception 'Rien à annuler';
  end if;

  insert into caisse.tickets (numero, journee_id, type, ticket_origine_id, motif, vendeur_id, client_id, client_nom, dossier_id, total_ht, total_tva, total_ttc)
  values (v_numero, v_journee, 'annulation', v_origine.id, v_motif, v_vendeur, v_origine.client_id, v_origine.client_nom, v_origine.dossier_id, v_ht, v_tva, v_ttc)
  returning id into v_ticket;

  for o in select * from _caisse_annul order by ordre
  loop
    insert into caisse.lignes (ticket_id, ordre, type, produit_id, code, designation, quantite, prix_unitaire_ttc, remise_ttc, taux_tva, total_ht, total_tva, total_ttc, ligne_origine_id)
    values (v_ticket, o.ordre, o.type, o.produit_id, o.code, o.designation, o.quantite, o.prix_unitaire_ttc, o.remise_ttc, o.taux_tva, o.total_ht, o.total_tva, o.total_ttc, o.ligne_id)
    returning id into v_ligne;
    if o.type = 'produit' and o.produit_id is not null then
      insert into public.mouvements_stock (produit_id, code_produit, type_mouvement, quantite, source, source_id, source_ligne_id, reference_document, date_document, created_by)
      values (o.produit_id, coalesce(o.code, ''), 'AJUSTEMENT', -o.quantite, 'CAISSE', v_ticket, v_ligne, 'Annulation ticket ' || v_origine.numero, current_date, auth.uid());
    end if;
  end loop;

  if v_ttc <> 0 then
    if v_moyen = 'avoir' then
      v_avoir_numero := 'AV-' || lpad(caisse._numero('avoir')::text, 4, '0');
      insert into caisse.avoirs (numero, montant, client_id, client_nom, emis_par_ticket_id, expire_le)
      values (v_avoir_numero, -v_ttc, v_origine.client_id, v_origine.client_nom, v_ticket, now() + interval '6 months')
      returning id into v_avoir;
      insert into caisse.paiements (ticket_id, moyen, montant, avoir_id)
      values (v_ticket, 'avoir', v_ttc, v_avoir);
      insert into caisse.journal (vendeur_id, evenement, cible_id, details)
      values (v_vendeur, 'avoir_emis', v_avoir, jsonb_build_object('numero', v_avoir_numero, 'montant', -v_ttc, 'ticket_id', v_ticket));
    else
      insert into caisse.paiements (ticket_id, moyen, montant)
      values (v_ticket, v_moyen, v_ttc);
    end if;
  end if;

  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'annulation', v_ticket, jsonb_build_object(
    'numero', v_numero, 'origine', v_origine.numero, 'motif', v_motif, 'montant', v_ttc, 'remboursement', v_moyen
  ));

  return jsonb_build_object(
    'ticket_id', v_ticket, 'numero', v_numero, 'total_ttc', v_ttc,
    'remboursement', v_moyen, 'avoir_numero', v_avoir_numero,
    'avoir_expire_le', case when v_avoir is not null then now() + interval '6 months' end
  );
end;
$$;

create or replace function caisse._agreger(p_journees uuid[])
returns table (nb int, ht numeric, tva numeric, ttc numeric, detail_tva jsonb, detail_moyens jsonb, especes numeric)
language sql
stable
security definer
set search_path = caisse, public
as $$
  select
    (select count(*)::int from caisse.tickets t where t.journee_id = any (p_journees)),
    (select coalesce(sum(t.total_ht), 0) from caisse.tickets t where t.journee_id = any (p_journees)),
    (select coalesce(sum(t.total_tva), 0) from caisse.tickets t where t.journee_id = any (p_journees)),
    (select coalesce(sum(t.total_ttc), 0) from caisse.tickets t where t.journee_id = any (p_journees)),
    (select coalesce(jsonb_agg(jsonb_build_object('taux', s.taux_tva, 'ht', s.ht, 'tva', s.tva, 'ttc', s.ttc) order by s.taux_tva), '[]'::jsonb)
     from (
       select l.taux_tva, sum(l.total_ht) as ht, sum(l.total_tva) as tva, sum(l.total_ttc) as ttc
       from caisse.lignes l
       join caisse.tickets t on t.id = l.ticket_id
       where t.journee_id = any (p_journees)
       group by l.taux_tva
     ) s),
    (select coalesce(jsonb_object_agg(s.moyen, s.total), '{}'::jsonb)
     from (
       select p.moyen, sum(p.montant) as total
       from caisse.paiements p
       join caisse.tickets t on t.id = p.ticket_id
       where t.journee_id = any (p_journees)
       group by p.moyen
     ) s),
    (select coalesce(sum(p.montant), 0)
     from caisse.paiements p
     join caisse.tickets t on t.id = p.ticket_id
     where t.journee_id = any (p_journees) and p.moyen = 'especes');
$$;

create or replace function caisse.apercu_cloture()
returns jsonb
language plpgsql
stable
security definer
set search_path = caisse, public
as $$
declare
  v_journee uuid := caisse._journee_ouverte();
  a record;
  v_fond numeric(12, 2);
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  if v_journee is null then
    return null;
  end if;
  select fond_ouverture into v_fond from caisse.journees where id = v_journee;
  select * into a from caisse._agreger(array[v_journee]);
  return jsonb_build_object(
    'journee_id', v_journee, 'nb_tickets', a.nb, 'total_ht', a.ht, 'total_tva', a.tva, 'total_ttc', a.ttc,
    'detail_tva', a.detail_tva, 'detail_moyens', a.detail_moyens, 'fond_ouverture', v_fond,
    'especes_attendues', v_fond + a.especes
  );
end;
$$;

create or replace function caisse.cloturer_journee(p_session uuid, p_especes_comptees numeric, p_fond_laisse numeric)
returns uuid
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_journee caisse.journees%rowtype;
  a record;
  v_gt numeric(16, 2);
  v_attendues numeric(12, 2);
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('caisse.journee'));
  select * into v_journee from caisse.journees where id = caisse._journee_ouverte();
  if not found then
    raise exception 'Aucune journée ouverte';
  end if;
  if p_especes_comptees is null or p_especes_comptees < 0 then
    raise exception 'Montant d''espèces compté invalide';
  end if;
  if p_fond_laisse is null or p_fond_laisse < 0 or p_fond_laisse > p_especes_comptees then
    raise exception 'Fond laissé invalide';
  end if;
  select * into a from caisse._agreger(array[v_journee.id]);
  v_attendues := v_journee.fond_ouverture + a.especes;
  select coalesce(
    (select c.grand_total_perpetuel from caisse.clotures c where c.type = 'jour' order by c.cree_le desc limit 1),
    0
  ) + a.ttc into v_gt;
  insert into caisse.clotures (
    type, periode, journee_id, nb_tickets, total_ht, total_tva, total_ttc, detail_tva, detail_moyens,
    grand_total_perpetuel, especes_attendues, especes_comptees, ecart, fond_laisse, remise_banque, cree_par
  )
  values (
    'jour',
    to_char(v_journee.ouverte_le at time zone 'Europe/Paris', 'YYYY-MM-DD') || '/' || v_journee.numero,
    v_journee.id, a.nb, a.ht, a.tva, a.ttc, a.detail_tva, a.detail_moyens,
    v_gt, v_attendues, round(p_especes_comptees, 2), round(p_especes_comptees, 2) - v_attendues,
    round(p_fond_laisse, 2), round(p_especes_comptees - p_fond_laisse, 2), v_vendeur
  )
  returning id into v_id;
  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'cloture', v_id, jsonb_build_object(
    'type', 'jour', 'journee', v_journee.numero, 'total_ttc', a.ttc, 'ecart', round(p_especes_comptees, 2) - v_attendues
  ));
  return v_id;
end;
$$;

create or replace function caisse.cloturer_periode(p_session uuid, p_type text, p_periode text)
returns uuid
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_debut date;
  v_fin date;
  v_journees uuid[];
  a record;
  v_gt numeric(16, 2);
  v_id uuid;
begin
  if p_type = 'mois' and p_periode ~ '^[0-9]{4}-[0-9]{2}$' then
    v_debut := to_date(p_periode || '-01', 'YYYY-MM-DD');
    v_fin := (v_debut + interval '1 month')::date;
  elsif p_type = 'an' and p_periode ~ '^[0-9]{4}$' then
    v_debut := to_date(p_periode || '-01-01', 'YYYY-MM-DD');
    v_fin := (v_debut + interval '1 year')::date;
  else
    raise exception 'Période invalide';
  end if;
  if (now() at time zone 'Europe/Paris')::date < v_fin then
    raise exception 'La période n''est pas terminée';
  end if;
  if exists (
    select 1 from caisse.journees j
    where (j.ouverte_le at time zone 'Europe/Paris')::date >= v_debut
      and (j.ouverte_le at time zone 'Europe/Paris')::date < v_fin
      and not exists (select 1 from caisse.clotures c where c.journee_id = j.id and c.type = 'jour')
  ) then
    raise exception 'Une journée de la période n''est pas clôturée';
  end if;
  if p_type = 'an' and exists (
    select 1
    from generate_series(v_debut, (v_fin - interval '1 month')::date, interval '1 month') m
    where exists (
      select 1 from caisse.journees j
      where date_trunc('month', j.ouverte_le at time zone 'Europe/Paris') = m
    )
    and not exists (
      select 1 from caisse.clotures c where c.type = 'mois' and c.periode = to_char(m, 'YYYY-MM')
    )
  ) then
    raise exception 'Clôture d''abord tous les mois de l''année';
  end if;
  select coalesce(array_agg(j.id), '{}') into v_journees
  from caisse.journees j
  where (j.ouverte_le at time zone 'Europe/Paris')::date >= v_debut
    and (j.ouverte_le at time zone 'Europe/Paris')::date < v_fin;
  select * into a from caisse._agreger(v_journees);
  select coalesce(
    (select c.grand_total_perpetuel from caisse.clotures c
     where c.type = 'jour' and c.journee_id = any (v_journees)
     order by c.cree_le desc limit 1),
    (select c.grand_total_perpetuel from caisse.clotures c
     join caisse.journees j on j.id = c.journee_id
     where c.type = 'jour' and (j.ouverte_le at time zone 'Europe/Paris')::date < v_debut
     order by c.cree_le desc limit 1),
    0
  ) into v_gt;
  insert into caisse.clotures (type, periode, nb_tickets, total_ht, total_tva, total_ttc, detail_tva, detail_moyens, grand_total_perpetuel, cree_par)
  values (p_type, p_periode, a.nb, a.ht, a.tva, a.ttc, a.detail_tva, a.detail_moyens, v_gt, v_vendeur)
  returning id into v_id;
  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'cloture', v_id, jsonb_build_object('type', p_type, 'periode', p_periode, 'total_ttc', a.ttc));
  return v_id;
end;
$$;

create or replace function caisse.verifier_avoir(p_numero text)
returns jsonb
language plpgsql
stable
security definer
set search_path = caisse, public
as $$
declare
  v caisse.avoirs%rowtype;
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  select * into v from caisse.avoirs where numero = upper(trim(p_numero));
  if not found then
    return jsonb_build_object('statut', 'introuvable');
  end if;
  return jsonb_build_object(
    'numero', v.numero,
    'montant', v.montant,
    'client_nom', v.client_nom,
    'emis_le', v.emis_le,
    'expire_le', v.expire_le,
    'statut', case
      when exists (select 1 from caisse.paiements p where p.avoir_id = v.id and p.moyen = 'avoir' and p.montant > 0) then 'utilise'
      when v.expire_le < now() then 'expire'
      else 'valide'
    end
  );
end;
$$;

create or replace function caisse.dossiers_prets()
returns jsonb
language plpgsql
stable
security definer
set search_path = caisse, public
as $$
declare
  v_res jsonb;
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  select coalesce(jsonb_agg(d order by d->>'date_reception'), '[]'::jsonb) into v_res
  from (
    select jsonb_build_object(
      'dossier_id', pec.id,
      'client_id', pec.client_id,
      'client_nom', trim(coalesce(pec.prenom, '') || ' ' || coalesce(pec.nom, '')),
      'telephone', pec.telephone,
      'marque_modele', pec.marque_modele,
      'date_reception', pec.date_reception,
      'prefacture_id', pf.id,
      'lignes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'produit_id', i.product_id,
          'code', i.product_code,
          'designation', i.product_designation,
          'quantite', i.quantity,
          'prix_unitaire_ttc', i.unit_price,
          'taux_tva', coalesce(p.vat_rate, 20)
        ) order by i.created_at)
        from public.prefacture_items i
        left join public.products p on p.id = i.product_id
        where i.prefacture_id = pf.id
      ), '[]'::jsonb),
      'acomptes', coalesce((
        select jsonb_agg(jsonb_build_object('ticket_id', t.id, 'numero', t.numero, 'montant', t.total_ttc, 'le', t.cree_le) order by t.numero)
        from caisse.tickets t
        where t.type = 'acompte' and t.dossier_id = pec.id
          and not exists (select 1 from caisse.lignes l where l.acompte_ticket_id = t.id and l.type = 'acompte_deduit')
          and not exists (select 1 from caisse.tickets a where a.ticket_origine_id = t.id)
      ), '[]'::jsonb)
    ) as d
    from public.prise_en_charge pec
    left join lateral (
      select x.id from public.prefactures x
      where x.reception_id = pec.id and x.status <> 'CANCELLED'
      order by x.created_at desc
      limit 1
    ) pf on true
    where pec.status = 'TERMINE'
  ) s;
  return v_res;
end;
$$;

create or replace function caisse.lier_facture(p_session uuid, p_ticket uuid, p_invoice uuid)
returns void
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
begin
  if not exists (select 1 from caisse.tickets where id = p_ticket and type = 'vente') then
    raise exception 'Ticket de vente introuvable';
  end if;
  if not exists (select 1 from public.invoices where id = p_invoice) then
    raise exception 'Facture introuvable';
  end if;
  insert into caisse.factures (ticket_id, invoice_id) values (p_ticket, p_invoice);
  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'facture', p_ticket, jsonb_build_object('invoice_id', p_invoice));
end;
$$;

create or replace function caisse.noter_duplicata(p_session uuid, p_ticket uuid)
returns int
language plpgsql
security definer
set search_path = caisse, public
as $$
declare
  v_vendeur uuid := caisse._vendeur(p_session);
  v_n int;
begin
  if not exists (select 1 from caisse.tickets where id = p_ticket) then
    raise exception 'Ticket introuvable';
  end if;
  select count(*) + 1 into v_n from caisse.journal where evenement = 'duplicata' and cible_id = p_ticket;
  insert into caisse.journal (vendeur_id, evenement, cible_id, details)
  values (v_vendeur, 'duplicata', p_ticket, jsonb_build_object('numero_duplicata', v_n));
  return v_n;
end;
$$;

create or replace function caisse.enregistrer_signature(p_cible text, p_cible_id uuid, p_reponse jsonb)
returns void
language plpgsql
security definer
set search_path = caisse, public
as $$
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  insert into caisse.signatures (cible, cible_id, reponse) values (p_cible, p_cible_id, p_reponse);
end;
$$;

create or replace function caisse.noter_erreur_signature(p_cible_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = caisse, public
as $$
begin
  if not caisse.est_vendeur() then
    raise exception 'Accès caisse refusé';
  end if;
  insert into caisse.journal (evenement, cible_id, details) values ('erreur_signature', p_cible_id, p_details);
end;
$$;

revoke all on all functions in schema caisse from public;

grant execute on function
  caisse.est_vendeur(),
  caisse.journee_ouverte(),
  caisse.creer_vendeur(text, text, text),
  caisse.changer_pin(uuid, text, text),
  caisse.connexion(uuid, text),
  caisse.deconnexion(uuid),
  caisse.ouvrir_journee(uuid, numeric),
  caisse.enregistrer_vente(uuid, jsonb),
  caisse.enregistrer_acompte(uuid, jsonb),
  caisse.annuler_ticket(uuid, jsonb),
  caisse.apercu_cloture(),
  caisse.cloturer_journee(uuid, numeric, numeric),
  caisse.cloturer_periode(uuid, text, text),
  caisse.verifier_avoir(text),
  caisse.dossiers_prets(),
  caisse.lier_facture(uuid, uuid, uuid),
  caisse.noter_duplicata(uuid, uuid),
  caisse.enregistrer_signature(text, uuid, jsonb),
  caisse.noter_erreur_signature(uuid, jsonb)
to authenticated;
