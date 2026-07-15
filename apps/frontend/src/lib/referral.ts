import { referralUsernameFromNom } from '@fast-rental/shared';
import { env } from './env';

type ReferralProfile = {
  nom?: string | null;
};

export function resolveReferralUsername(profile: ReferralProfile): string | null {
  return referralUsernameFromNom(profile.nom);
}

export function buildListingReferralUrl(profile: ReferralProfile, listingId: string): string | null {
  const username = resolveReferralUsername(profile);
  if (!username) return null;
  return `${env.VITE_PUBLIC_SITE_URL}/inventaire/${username}?listing=${listingId}`;
}

export function buildInventoryReferralUrl(profile: ReferralProfile): string | null {
  const username = resolveReferralUsername(profile);
  if (!username) return null;
  return `${env.VITE_PUBLIC_SITE_URL}/inventaire/${username}`;
}

export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy failed');
}
