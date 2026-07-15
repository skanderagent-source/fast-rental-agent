import type {
  LISTING_SOURCES,
  LISTING_STATUSES,
  MEDIA_STATUSES,
  MEDIA_TYPES,
  TRAITEMENT_STATUTS,
  USER_ROLES,
} from './constants.js';

export type UserRole = (typeof USER_ROLES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ListingSource = (typeof LISTING_SOURCES)[number];
export type MediaStatus = (typeof MEDIA_STATUSES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type TraitementStatut = (typeof TRAITEMENT_STATUTS)[number];

export type AgentProfile = {
  id: string;
  email: string;
  nom: string;
  telephone: string | null;
  role: UserRole;
  actif: boolean;
  must_change_password: boolean;
  profile_photo_media_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  adresse: string;
  quartier: string | null;
  prix: number | null;
  taille: string | null;
  statut: ListingStatus;
  electromenagers: string | null;
  code_entree: string | null;
  concierge_tel: string | null;
  notes: string | null;
  source: string;
  sheet_row_id: string | null;
  latitude: number | null;
  longitude: number | null;
  created_by: string | null;
  deleted_at: string | null;
  manual_overrides: Record<string, boolean>;
  sheet_updated_at: string | null;
  geocoded_at: string | null;
  geocoding_status: 'pending' | 'success' | 'failed' | 'manual' | null;
  geocoding_error: string | null;
  locataire_nom: string | null;
  locataire_tel: string | null;
  ville: string | null;
  date_disponibilite: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  approved_media_count?: number;
  approved_image_count?: number;
  pending_media_count?: number;
};

export type MapListing = Pick<
  Listing,
  'id' | 'adresse' | 'quartier' | 'prix' | 'statut' | 'latitude' | 'longitude'
>;

export type MapListingsResponse = {
  items: MapListing[];
  total: number;
  truncated: boolean;
};

export type ListingMedia = {
  id: string;
  listing_id: string;
  uploaded_by: string;
  approved_by: string | null;
  type: MediaType;
  status: MediaStatus;
  bucket: string;
  object_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  rejection_reason: string | null;
  upload_completed_at: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  approved_at: string | null;
  viewUrl?: string;
  thumbnailUrl?: string;
};

export type Lead = {
  id: string;
  listing_id: string | null;
  nom: string;
  telephone: string | null;
  email: string | null;
  revenu_mensuel: number | null;
  score_credit: number | null;
  date_demenagement: string | null;
  message: string | null;
  type_demande: 'rappel' | 'prequal';
  statut: 'nouveau' | 'archivé';
  traitement_statut: TraitementStatut | null;
  lu: boolean;
  assigne_a: string | null;
  assigne_nom: string | null;
  assigne_le: string | null;
  assignation_type: 'manual' | 'auto_referral' | null;
  ref_agent_id: string | null;
  archived_at: string | null;
  delete_after: string | null;
  last_agent_update_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadListItem = Lead & {
  listing_adresse?: string | null;
  ref_agent_nom?: string | null;
};

export type Comment = {
  id: string;
  logement_id: string;
  agent_id: string;
  agent_nom: string;
  texte: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  agent_id: string | null;
  agent_nom: string | null;
  type_action: string;
  details: string;
  logement_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Rental = {
  id: string;
  listing_id: string;
  agent_id: string;
  lead_id: string | null;
  monthly_rent: number | null;
  rented_at: string;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ListingSummary = {
  total: number;
  available: number;
  onHold: number;
  averagePrice: number | null;
};

export type AgentStats = {
  agentId: string;
  nom: string;
  email: string;
  assignedLeads: number;
  contactedLeads: number;
  resolvedLeads: number;
  refusedLeads: number;
  rentalCount: number;
  rentalRevenueTotal: number;
  mediaUploaded: number;
  approvedMedia: number;
  rejectedMedia: number;
  lastLoginAt: string | null;
};
