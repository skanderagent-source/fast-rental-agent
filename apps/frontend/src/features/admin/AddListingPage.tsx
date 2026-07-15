import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { useToast } from '../../components/common/ToastProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

type ListingForm = {
  adresse: string;
  quartier: string;
  prix: string;
  taille: string;
  statut: string;
  electromenagers: string;
  code_entree: string;
  concierge_tel: string;
  notes: string;
  latitude: string;
  longitude: string;
};

type FieldConfig = {
  key: keyof ListingForm;
  label: string;
  kind?: 'size' | 'statut';
  type?: 'number';
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
};

type FormSection = {
  title: string;
  description: string;
  fields: FieldConfig[];
};

const listingFormSections: FormSection[] = [
  {
    title: 'Informations principales',
    description: 'Adresse, quartier et disponibilité du logement.',
    fields: [
      { key: 'adresse', label: 'Adresse', placeholder: '123 rue Exemple, Montréal', wide: true },
      { key: 'quartier', label: 'Quartier', placeholder: 'Plateau-Mont-Royal' },
      { key: 'prix', label: 'Prix mensuel ($)', type: 'number', placeholder: '1500' },
      { key: 'taille', label: 'Taille', kind: 'size' },
      { key: 'statut', label: 'Statut', kind: 'statut' },
    ],
  },
  {
    title: 'Accès et équipement',
    description: 'Coordonnées utiles pour les visites et la remise des clés.',
    fields: [
      { key: 'electromenagers', label: 'Électroménagers', placeholder: 'Frigo, laveuse, sécheuse…' },
      { key: 'code_entree', label: 'Code d\'entrée', placeholder: '1234#' },
      { key: 'concierge_tel', label: 'Téléphone du concierge', placeholder: '514-555-0100' },
    ],
  },
  {
    title: 'Notes internes',
    description: 'Visible uniquement par les agents dans l\'application.',
    fields: [
      { key: 'notes', label: 'Notes', placeholder: 'Informations complémentaires…', wide: true, multiline: true },
    ],
  },
  {
    title: 'Coordonnées GPS',
    description: 'Optionnel. Laissez vide pour géocoder automatiquement à partir de l\'adresse.',
    fields: [
      { key: 'latitude', label: 'Latitude', type: 'number', placeholder: '45.5017' },
      { key: 'longitude', label: 'Longitude', type: 'number', placeholder: '-73.5673' },
    ],
  },
];

function emptyForm(): ListingForm {
  return {
    adresse: '',
    quartier: '',
    prix: '',
    taille: '',
    statut: 'Available',
    electromenagers: '',
    code_entree: '',
    concierge_tel: '',
    notes: '',
    latitude: '',
    longitude: '',
  };
}

function listingToForm(listing: Record<string, unknown>): ListingForm {
  return {
    adresse: String(listing.adresse ?? ''),
    quartier: String(listing.quartier ?? ''),
    prix: listing.prix != null ? String(listing.prix) : '',
    taille: String(listing.taille ?? ''),
    statut: String(listing.statut ?? 'Available'),
    electromenagers: String(listing.electromenagers ?? ''),
    code_entree: String(listing.code_entree ?? ''),
    concierge_tel: String(listing.concierge_tel ?? ''),
    notes: String(listing.notes ?? ''),
    latitude: listing.latitude != null ? String(listing.latitude) : '',
    longitude: listing.longitude != null ? String(listing.longitude) : '',
  };
}

function formToPayload(form: ListingForm) {
  return {
    adresse: form.adresse,
    quartier: form.quartier || null,
    prix: form.prix ? Number(form.prix) : null,
    taille: form.taille || null,
    statut: form.statut,
    electromenagers: form.electromenagers || null,
    code_entree: form.code_entree || null,
    concierge_tel: form.concierge_tel || null,
    notes: form.notes || null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
  };
}

const fieldLabels = Object.fromEntries(
  listingFormSections.flatMap((section) => section.fields.map((field) => [field.key, field.label])),
) as Record<keyof ListingForm, string>;

const statutLabels: Record<string, string> = {
  Available: 'Disponible',
  'On Hold': 'En attente',
  'Not Available': 'Non dispo',
  'In Reno': 'Rénovation',
  Rented: 'Loué',
};

function displayFormValue(key: keyof ListingForm, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '—';
  if (key === 'statut') return statutLabels[trimmed] ?? trimmed;
  if (key === 'prix') return `$${Number(trimmed).toLocaleString('fr-CA')}`;
  return trimmed;
}

function getFilledFormFields(form: ListingForm) {
  const fields: { label: string; value: string }[] = [];
  for (const key of Object.keys(form) as (keyof ListingForm)[]) {
    const value = form[key].trim();
    if (!value) continue;
    fields.push({ label: fieldLabels[key], value: displayFormValue(key, form[key]) });
  }
  return fields;
}

function getFormChanges(original: ListingForm, current: ListingForm) {
  const changes: { label: string; old: string; new: string }[] = [];
  for (const key of Object.keys(original) as (keyof ListingForm)[]) {
    if (original[key].trim() === current[key].trim()) continue;
    changes.push({
      label: fieldLabels[key],
      old: displayFormValue(key, original[key]),
      new: displayFormValue(key, current[key]),
    });
  }
  return changes;
}

function ListingFormFields({ form, setForm }: { form: ListingForm; setForm: (f: ListingForm) => void }) {
  return (
    <>
      {listingFormSections.map((section) => (
        <section key={section.title} className="profile-card listing-form-section">
          <h3 className="profile-card__title">{section.title}</h3>
          <p className="listing-form-section__desc">{section.description}</p>
          <div className="listing-form-grid">
            {section.fields.map(({ key, label, kind, type, placeholder, wide, multiline }) => {
              const inputId = `listing-${key}`;
              return (
                <div
                  key={key}
                  className={`form-field listing-form-field${wide ? ' listing-form-field--wide' : ''}`}
                >
                  <label htmlFor={inputId}>{label}</label>
                  {kind === 'statut' ? (
                    <select
                      id={inputId}
                      value={form.statut}
                      onChange={(e) => setForm({ ...form, statut: e.target.value })}
                    >
                      <option value="Available">Disponible</option>
                      <option value="On Hold">En attente</option>
                      <option value="Not Available">Non dispo</option>
                      <option value="In Reno">Rénovation</option>
                      <option value="Rented">Loué</option>
                    </select>
                  ) : kind === 'size' ? (
                    <select
                      id={inputId}
                      value={form.taille}
                      onChange={(e) => setForm({ ...form, taille: e.target.value })}
                    >
                      <option value="">Choisir une taille…</option>
                      {['2.5', '3.5', '4.5', '5.5', '6.5'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : multiline ? (
                    <textarea
                      id={inputId}
                      rows={4}
                      value={form[key]}
                      placeholder={placeholder}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  ) : (
                    <input
                      id={inputId}
                      type={type ?? 'text'}
                      value={form[key]}
                      placeholder={placeholder}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function GeocodingStatus({ status, error }: { status?: string | null; error?: string | null }) {
  if (!status) return null;
  const labels: Record<string, string> = {
    pending: 'Géocodage en cours…',
    success: 'Géocodage réussi',
    manual: 'Coordonnées manuelles enregistrées',
    failed: 'Géocodage échoué',
  };
  const tone = status === 'failed' ? 'listing-form-geocode--error' : status === 'success' || status === 'manual' ? 'listing-form-geocode--ok' : '';
  return (
    <div className={`listing-form-geocode ${tone}`}>
      <span className="listing-form-geocode__icon" aria-hidden>📍</span>
      <div>
        <div className="listing-form-geocode__title">{labels[status] ?? status}</div>
        {error && <div className="listing-form-geocode__detail">{error}</div>}
      </div>
    </div>
  );
}

function ListingFormPage({
  title,
  subtitle,
  geocodeStatus,
  geocodeError,
  submitLabel,
  onSubmit,
  editActions,
  form,
  setForm,
}: {
  title: string;
  subtitle: string;
  geocodeStatus?: string | null;
  geocodeError?: string | null;
  submitLabel?: string;
  onSubmit?: (e: React.FormEvent) => void;
  editActions?: {
    onDelete: () => void;
    onModify: () => void;
    onCancel: () => void;
  };
  form: ListingForm;
  setForm: (f: ListingForm) => void;
}) {
  return (
    <div className="panel-scroll listing-form-page">
      <header className="listing-form-header">
        <h2 className="listing-form-header__title">{title}</h2>
        <p className="listing-form-header__subtitle">{subtitle}</p>
      </header>

      <GeocodingStatus status={geocodeStatus} error={geocodeError} />

      <form className="listing-form" onSubmit={onSubmit ?? ((e) => e.preventDefault())}>
        <ListingFormFields form={form} setForm={setForm} />
        <div className={`listing-form-actions profile-card${editActions ? ' listing-form-actions--edit' : ''}`}>
          {editActions ? (
            <>
              <button
                type="button"
                className="profile-btn profile-btn--danger"
                onClick={editActions.onDelete}
              >
                Supprimer
              </button>
              <button
                type="button"
                className="profile-btn profile-btn--primary"
                onClick={editActions.onModify}
              >
                Modifier
              </button>
              <button
                type="button"
                className="profile-btn profile-btn--white"
                onClick={editActions.onCancel}
              >
                Annuler
              </button>
            </>
          ) : (
            <button type="submit" className="profile-btn profile-btn--primary listing-form-actions__submit">
              {submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function AddListingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ListingForm>(emptyForm());
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const [addStep, setAddStep] = useState<0 | 1 | 2>(0);

  const filledFields = useMemo(() => getFilledFormFields(form), [form]);

  function cancelAdd() {
    setAddStep(0);
  }

  function startAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.adresse.trim()) return toast('⚠️ Adresse requise');
    setAddStep(1);
  }

  async function applyAdd() {
    const created = await api.post<{ geocoding_status?: string }>('/api/listings', formToPayload(form));
    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
    setGeocodeStatus(created.geocoding_status ?? (form.latitude && form.longitude ? 'manual' : 'pending'));
    toast('✅ Logement ajouté');
    setAddStep(0);
    setTimeout(() => navigate('/app/search'), 1200);
  }

  return (
    <>
      <ListingFormPage
        title="Ajouter un logement"
        subtitle="Renseignez les informations du logement. Les champs marqués par l'adresse sont essentiels pour la recherche et la carte."
        geocodeStatus={geocodeStatus}
        submitLabel="Ajouter le logement"
        onSubmit={startAdd}
        form={form}
        setForm={setForm}
      />

      <ConfirmDialog
        open={addStep === 1}
        message="Vous êtes sur le point d'ajouter ce logement."
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => setAddStep(2)}
        onCancel={cancelAdd}
      />
      <ConfirmDialog
        open={addStep === 2}
        wide
        message={(
          <>
            <p style={{ margin: 0 }}>Le logement {form.adresse.trim()} sera ajouté.</p>
            {filledFields.length > 0 && (
              <ul className="confirm-dialog__changes">
                {filledFields.map((field) => (
                  <li key={field.label} className="confirm-dialog__change">
                    <span className="confirm-dialog__change-label">{field.label}</span>
                    <span className="confirm-dialog__change-values">{field.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => void applyAdd()}
        onCancel={cancelAdd}
      />
    </>
  );
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ListingForm>(emptyForm());
  const [originalForm, setOriginalForm] = useState<ListingForm>(emptyForm());
  const [editStep, setEditStep] = useState<0 | 1 | 2>(0);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['listing-edit', id],
    queryFn: () => api.get<{ listing: Record<string, unknown> }>(`/api/listings/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (!data?.listing) return;
    const next = listingToForm(data.listing);
    setForm(next);
    setOriginalForm(next);
  }, [data?.listing]);

  const address = originalForm.adresse.trim() || form.adresse.trim();
  const formChanges = useMemo(() => getFormChanges(originalForm, form), [originalForm, form]);

  function cancelEditFlow() {
    setEditStep(0);
  }

  function cancelDeleteFlow() {
    setDeleteStep(0);
  }

  function startModify() {
    if (!form.adresse.trim()) return toast('⚠️ Adresse requise');
    if (formChanges.length === 0) return toast('Aucune modification détectée');
    setEditStep(1);
  }

  function startDelete() {
    setDeleteStep(1);
  }

  function cancelEdits() {
    navigate('/app/search');
  }

  async function applyChanges() {
    if (!id) return;
    await api.patch(`/api/listings/${id}`, formToPayload(form));
    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
    void queryClient.invalidateQueries({ queryKey: ['listing-edit', id] });
    toast('✅ Logement mis à jour');
    setEditStep(0);
    navigate('/app/search');
  }

  async function confirmDelete() {
    if (!id) return;
    await api.delete(`/api/listings/${id}`);
    void queryClient.invalidateQueries({ queryKey: ['listings'] });
    void queryClient.invalidateQueries({ queryKey: ['listings-map'] });
    toast('Logement supprimé');
    setDeleteStep(0);
    navigate('/app/search');
  }

  if (isLoading) return <div className="panel-scroll empty">Chargement…</div>;
  if (error || !id) return <div className="panel-scroll empty">Logement introuvable</div>;

  return (
    <>
      <ListingFormPage
        title="Modifier le logement"
        subtitle="Mettez à jour les informations affichées aux agents."
        geocodeStatus={String(data?.listing?.geocoding_status ?? '')}
        geocodeError={data?.listing?.geocoding_error ? String(data.listing.geocoding_error) : null}
        editActions={{
          onDelete: startDelete,
          onModify: startModify,
          onCancel: cancelEdits,
        }}
        form={form}
        setForm={setForm}
      />

      <ConfirmDialog
        open={editStep === 1}
        message="Vous êtes sur le point de modifier ce logement."
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => setEditStep(2)}
        onCancel={cancelEditFlow}
      />
      <ConfirmDialog
        open={editStep === 2}
        wide
        message={(
          <>
            <p style={{ margin: 0 }}>Vous êtes sur le point de modifier {address}.</p>
            {formChanges.length > 0 && (
              <ul className="confirm-dialog__changes">
                {formChanges.map((change) => (
                  <li key={change.label} className="confirm-dialog__change">
                    <span className="confirm-dialog__change-label">{change.label}</span>
                    <span className="confirm-dialog__change-values">
                      {change.old} → {change.new}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmTone="primary"
        onConfirm={() => void applyChanges()}
        onCancel={cancelEditFlow}
      />

      <ConfirmDialog
        open={deleteStep === 1}
        message={`Vous allez supprimer ${address}.`}
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        onConfirm={() => setDeleteStep(2)}
        onCancel={cancelDeleteFlow}
      />
      <ConfirmDialog
        open={deleteStep === 2}
        message={`Vous êtes sur le point de supprimer ${address}.`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDeleteFlow}
      />
    </>
  );
}
