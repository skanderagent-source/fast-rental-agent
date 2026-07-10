import { geocodeAllPendingListings } from '../modules/listings/listings.geocode.js';

const result = await geocodeAllPendingListings();

console.log('\n===== TERMINÉ =====');
console.log(`Total: ${result.total}`);
console.log(`Géocodés: ${result.success}`);
console.log(`Depuis cache: ${result.cached}`);
console.log(`Échecs: ${result.failed}`);
console.log(`Ignorés: ${result.skipped}`);

process.exit(result.failed > 0 ? 1 : 0);
