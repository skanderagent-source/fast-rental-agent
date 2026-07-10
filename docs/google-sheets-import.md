# Google Sheets import (Fast Rental + Orcha)

Handoff complet : voir aussi [`new feature`](../new%20feature) à la racine du repo.

## Deux façons d'importer

### 1. Depuis l'app admin (recommandé avec service account)

Configure `GOOGLE_SERVICE_ACCOUNT_EMAIL` et `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` dans `apps/backend/.env`, puis partage les 2 Google Sheets avec ce compte (lecture).

1. Appliquer la migration `0007_sheet_import_columns.sql` (`npm run db:push`)
2. Admin → **Aperçu (sans écriture)** — `GET /api/admin/sheets/preview`
3. Admin → **Importer depuis Sheets** — `POST /api/admin/sheets/import` (UPSERT par `sheet_row_id`)
4. Optionnel : **Sync (respecte overrides)** — ne remplace pas les champs modifiés manuellement dans l'app

Sources lues :

| Source | Spreadsheet | Onglet | Colonne adresse |
|--------|-------------|--------|-----------------|
| `fast_rental` | `GOOGLE_SHEET_FAST_RENTAL_ID` | `Sheet1` | `Address` (en-têtes ligne 2) |
| `orcha` | `GOOGLE_SHEET_ORCHA_ID` | `orcha rentals` | `Eft form` |

`sheet_row_id` = `fast_rental|adressenormalisee` ou `orcha|...` — relançable sans doublons.

### 2. Google Apps Script (sans service account)

Si tu n'as pas de service account Google, utilise le script dans [`scripts/google-apps-script/import-logigo-logements.gs`](../scripts/google-apps-script/import-logigo-logements.gs) :

1. SQL préalable (migration 0007)
2. [script.google.com](https://script.google.com) → coller le script
3. `testerImport` → aperçu
4. `lancerImport` → écriture Supabase

⚠️ Ne jamais committer la clé `service_role` Supabase.

## Sécurité des champs locataire

- `locataire_nom` / `locataire_tel` : **internes agent uniquement** (jamais exposés sur `/api/public/*`)
- `notes` : peut être public — ne jamais y mettre le téléphone du locataire Orcha

## Après l'import initial

Supabase devient la source de vérité. Un re-import ou sync ne met à jour que les lignes **nouvelles ou modifiées** (comparaison champ par champ). Les champs modifiés manuellement dans l'app sont ignorés en mode **Sync** via `manual_overrides`.

Puis lancer le géocodage pour les logements sans coordonnées :

```bash
npm run geocode
```

(~1,1 s par adresse nouvelle, cache Supabase pour les doublons). Voir `docs/operations.md`.
