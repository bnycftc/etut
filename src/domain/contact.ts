/**
 * The "İletişim" row in Hakkında: an e-mail with a prefilled subject. Only the app and OS
 * versions go into it, nothing personal (hukuk/03 K-31: a visible contact channel; K-32: nothing
 * else collected). The address comes from `DATA_CONTROLLER.contact` in strings.ts.
 */

/** A plain e-mail address, or `null` (the `[DOLDURULACAK]` placeholder, a web address, …). */
export function contactEmail(contact: string): string | null {
  const value = contact.trim();
  return /^[^\s@<>()[\]\\,;:"?&=/]+@[^\s@<>()[\]\\,;:"?&=/]+\.[A-Za-z]{2,}$/.test(value) ? value : null;
}

/** `mailto:` link with only a subject (no body, no other fields). */
export function feedbackMailUrl(address: string, subject: string): string {
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}
