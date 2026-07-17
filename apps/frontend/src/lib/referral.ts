import { joinPublicUrl, referralUsernameFromNom } from '@fast-rental/shared';
import { copyTextToClipboard as copyText } from './clipboard';
import { env } from './env';

type ReferralProfile = {
  nom: string;
  referral_slug?: string | null;
};

export function joinPublicSitePath(path: string, baseUrl = env.VITE_PUBLIC_SITE_URL): string {
  return joinPublicUrl(baseUrl, path);
}

export function resolveReferralUsername(profile: ReferralProfile): string | null {
  return referralUsernameFromNom(profile.nom);
}

export function buildListingReferralUrl(
  profile: ReferralProfile,
  listingId: string,
  baseUrl = env.VITE_PUBLIC_SITE_URL,
): string | null {
  const username = resolveReferralUsername(profile);
  if (!username) return null;
  return joinPublicSitePath(
    `/inventaire/${encodeURIComponent(username)}?listing=${encodeURIComponent(listingId)}`,
    baseUrl,
  );
}

export function buildInventoryReferralUrl(
  profile: ReferralProfile,
  baseUrl = env.VITE_PUBLIC_SITE_URL,
): string | null {
  const username = resolveReferralUsername(profile);
  if (!username) return null;
  return joinPublicSitePath(`/inventaire/${encodeURIComponent(username)}`, baseUrl);
}

export { copyText as copyTextToClipboard };
