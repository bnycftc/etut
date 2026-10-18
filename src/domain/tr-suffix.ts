/**
 * Turkish suffix after a number, following how the number is read aloud (not its last digit):
 * 42 "kırk iki" → `%42’si`, 10 "on" → `%10’u`, 100 "yüz" → `%100’ü`, 0 "sıfır" → `%0’ı`.
 */

/** Third-person possessive (-(s)I), as in `%42’si`: `i`, `si`, `ı`, `sı`, `u` or `ü`. */
export type PossessiveSuffix = 'i' | 'si' | 'ı' | 'sı' | 'u' | 'ü';

/** By the last digit's word (bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz). */
const BY_UNIT: readonly PossessiveSuffix[] = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
/** By the tens word (on, yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan); index 0 unused. */
const BY_TEN: readonly PossessiveSuffix[] = ['ı', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı'];

/** The suffix for the last spoken word of a whole number: its last non-zero place (yüz, bin, milyon, milyar). */
export function possessiveSuffix(n: number): PossessiveSuffix {
  const x = Math.trunc(Math.abs(n));
  if (!Number.isSafeInteger(x)) return 'i';
  if (x === 0) return BY_UNIT[0];
  if (x % 10 !== 0) return BY_UNIT[x % 10];
  if (x % 100 !== 0) return BY_TEN[(x % 100) / 10];
  if (x % 1000 !== 0) return 'ü'; // yüz
  if (x % 1_000_000 !== 0) return 'i'; // bin
  if (x % 1_000_000_000 !== 0) return 'u'; // milyon
  return 'ı'; // milyar
}

/** `’si` after 42: the apostrophe plus the suffix, ready to append to the number. */
export function possessive(n: number): string {
  return `’${possessiveSuffix(n)}`;
}
