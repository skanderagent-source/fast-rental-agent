-- Google Sheets one-time import columns (see docs/google-sheets-import.md)

alter table logements
  add column if not exists locataire_nom text,
  add column if not exists locataire_tel text,
  add column if not exists ville text,
  add column if not exists date_disponibilite text;

comment on column logements.locataire_nom is
  'Nom du locataire actuel (si occupé) — usage interne agent, ne pas exposer au public';
comment on column logements.locataire_tel is
  'Téléphone du locataire actuel — usage interne agent, ne pas exposer au public';
comment on column logements.ville is
  'Ville dérivée de la colonne Area/quartier (Montréal par défaut)';
comment on column logements.date_disponibilite is
  'Date de disponibilité telle que lue depuis Google Sheets';

-- Ensure UPSERT key for sheet imports (may already exist from 0001)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'logements_sheet_row_id_key') then
    alter table logements add constraint logements_sheet_row_id_key unique (sheet_row_id);
  end if;
end $$;
