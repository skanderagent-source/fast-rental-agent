import { resolveAgentReferralUsername } from '@fast-rental/shared';
import { copyTextToClipboard as copyText } from './clipboard';
import { env } from './env';

type ReferralProfile = {
  nom: string;
  referral_slug?: string | null;
};

export function resolveReferralUsername(profile: ReferralProfile): string | null {
  return resolveAgentReferralUsername(profile);
}

export function buildListingReferralUrl(profile: ReferralProfile, listingId: string): string | null {
  const username = resolveReferralUsername(profile);
  if (!username) return null;
  return `${env.VITE_PUBLIC_SITE_URL}/inventaire/${encodeURIComponent(username)}?listing=${encodeURIComponent(listingId)}`;
}

export function buildInventoryReferralUrl(profile: ReferralProfile): string | null {
  const username = resolveReferralUsername(profile);
  if (!username) return null;
  return `${env.VITE_PUBLIC_SITE_URL}/inventaire/${encodeURIComponent(username)}`;
}

export { copyText as copyTextToClipboard };
