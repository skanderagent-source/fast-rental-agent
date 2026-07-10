/**
 * ============================================================================
 * GÉOCODAGE — Adresses → coordonnées GPS (latitude/longitude)
 * Pour le backend LogiGo (Node.js, ex: sur Hostinger)
 * ============================================================================
 *
 * Convertit une adresse texte ("4037 Adam, Montréal") en {lat, lon} pour
 * afficher les logements sur la carte. Utilise Nominatim (OpenStreetMap), gratuit.
 *
 * ⚠️ LIRE AVANT D'UTILISER — les règles de Nominatim sont STRICTES et leur
 *    non-respect fait BANNIR l'IP du serveur (pas juste un ralentissement) :
 *
 *   1. MAXIMUM 1 requête par seconde. Absolu. Ce module l'impose (file d'attente).
 *   2. User-Agent obligatoire avec un vrai email de contact identifiable.
 *      (Un User-Agent générique ou "example.com" = ban.)
 *   3. Interdiction du géocodage massif "brut". Pour ~690 adresses, on est à la
 *      limite de l'acceptable : on DOIT donc mettre en cache et ne jamais
 *      re-géocoder une adresse déjà connue. Ce module met en cache dans Supabase.
 *   4. Pour un usage vraiment intensif/commercial récurrent, envisager un
 *      service payant (Google Geocoding, Mapbox, LocationIQ) — mais pour un
 *      import ponctuel de 690 adresses avec cache, Nominatim gratuit suffit.
 *
 * VARIABLES .env attendues :
 *   GEOCODING_PROVIDER=nominatim
 *   GEOCODING_USER_AGENT=LogiGo/1.0 skander.agent@gmail.com   ← vrai email !
 *   GEOCODING_BASE_URL=https://nominatim.openstreetmap.org/search
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (pour lire/écrire lat/lon dans logements)
 * ============================================================================
 */

const USER_AGENT   = process.env.GEOCODING_USER_AGENT || 'LogiGo/1.0 contact@logigo.ca';
const BASE_URL     = process.env.GEOCODING_BASE_URL   || 'https://nominatim.openstreetmap.org/search';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIN_DELAY_MS = 1100; // 1.1s entre requêtes — marge de sécurité sous la limite 1/sec

// ---------------------------------------------------------------------------
// File d'attente : garantit qu'on ne dépasse JAMAIS 1 requête/seconde, même si
// le code appelle geocode() en boucle rapide. Chaque appel attend son tour.
// ---------------------------------------------------------------------------
let lastRequestTime = 0;
async function waitForSlot() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Appel Nominatim pour UNE adresse. Retourne {lat, lon} ou null.
// On ajoute ", Québec, Canada" pour améliorer la précision (sinon Nominatim
// peut confondre avec des rues homonymes ailleurs dans le monde).
// ---------------------------------------------------------------------------
async function geocodeOne(adresse, ville) {
  await waitForSlot();

  const query = `${adresse}, ${ville || 'Montréal'}, Québec, Canada`;
  const url = `${BASE_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ca`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,          // OBLIGATOIRE
        'Accept-Language': 'fr'
      }
    });
    if (!resp.ok) {
      console.warn(`Géocodage HTTP ${resp.status} pour "${query}"`);
      return null;
    }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    };
  } catch (e) {
    console.error(`Erreur géocodage "${query}":`, e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers Supabase pour le CACHE : on ne géocode que les logements qui n'ont
// pas encore de latitude/longitude, et on écrit le résultat pour ne jamais
// refaire le travail. C'est CE qui rend l'usage de Nominatim acceptable.
// ---------------------------------------------------------------------------
function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

// Récupère les logements SANS coordonnées (latitude NULL).
async function getLogementsSansCoords() {
  const url = `${SUPABASE_URL}/rest/v1/logements`
    + `?select=id,adresse,ville&latitude=is.null&order=created_at.asc`;
  const resp = await fetch(url, { headers: sbHeaders() });
  if (!resp.ok) throw new Error(`Lecture logements: HTTP ${resp.status}`);
  return resp.json();
}

// Écrit lat/lon sur un logement précis.
async function updateCoords(id, lat, lon) {
  const url = `${SUPABASE_URL}/rest/v1/logements?id=eq.${id}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ latitude: lat, longitude: lon })
  });
  return resp.ok;
}

// ---------------------------------------------------------------------------
// FONCTION PRINCIPALE : géocode tous les logements sans coordonnées.
// À lancer une fois après l'import, puis ponctuellement pour les nouveaux.
// Grâce au filtre latitude=is.null, relancer ne re-géocode QUE les nouveaux.
// ---------------------------------------------------------------------------
async function geocoderTousLesLogements() {
  const logements = await getLogementsSansCoords();
  console.log(`${logements.length} logements à géocoder (~${Math.ceil(logements.length * 1.1 / 60)} min estimées)`);

  let ok = 0, echec = 0;
  for (let i = 0; i < logements.length; i++) {
    const lg = logements[i];
    const coords = await geocodeOne(lg.adresse, lg.ville);

    if (coords) {
      const written = await updateCoords(lg.id, coords.lat, coords.lon);
      if (written) { ok++; console.log(`✅ ${i+1}/${logements.length} ${lg.adresse} → ${coords.lat},${coords.lon}`); }
      else { echec++; console.warn(`⚠️ Écriture échouée: ${lg.adresse}`); }
    } else {
      echec++;
      console.warn(`❌ ${i+1}/${logements.length} Introuvable: ${lg.adresse}`);
      // Adresse introuvable : reste latitude=NULL, sera réessayée au prochain run.
      // Souvent dû à une adresse mal formée dans le sheet source → à corriger à la main.
    }
  }
  console.log(`\n===== TERMINÉ : ${ok} géocodés, ${echec} échecs =====`);
  return { ok, echec };
}

module.exports = { geocodeOne, geocoderTousLesLogements };

// Pour lancer directement : node geocode.js
if (require.main === module) {
  geocoderTousLesLogements().catch(console.error);
}
