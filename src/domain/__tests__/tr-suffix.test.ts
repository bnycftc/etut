import { possessive, possessiveSuffix } from '../tr-suffix';

describe('possessiveSuffix: follows how the number is read aloud', () => {
  it.each([
    [0, 'ı'], // sıfır
    [1, 'i'], // bir
    [2, 'si'], // iki
    [3, 'ü'], // üç
    [4, 'ü'], // dört
    [5, 'i'], // beş
    [6, 'sı'], // altı
    [7, 'si'], // yedi
    [8, 'i'], // sekiz
    [9, 'u'], // dokuz
  ])('last digit %i', (n, suffix) => {
    expect(possessiveSuffix(n)).toBe(suffix);
  });

  it.each([
    [10, 'u'], // on
    [20, 'si'], // yirmi
    [30, 'u'], // otuz
    [40, 'ı'], // kırk
    [50, 'si'], // elli
    [60, 'ı'], // altmış
    [70, 'i'], // yetmiş
    [80, 'i'], // seksen
    [90, 'ı'], // doksan
    [100, 'ü'], // yüz
    [200, 'ü'],
    [1000, 'i'], // bin
    [2000, 'i'],
    [1_000_000, 'u'], // milyon
  ])('round number %i', (n, suffix) => {
    expect(possessiveSuffix(n)).toBe(suffix);
  });

  it('the last spoken word decides, not the first digit', () => {
    expect(possessiveSuffix(42)).toBe('si'); // kırk iki
    expect(possessiveSuffix(11)).toBe('i'); // on bir
    expect(possessiveSuffix(16)).toBe('sı'); // on altı
    expect(possessiveSuffix(99)).toBe('u'); // doksan dokuz
    expect(possessiveSuffix(100)).toBe('ü');
    expect(possessiveSuffix(101)).toBe('i'); // yüz bir
    expect(possessiveSuffix(1001)).toBe('i');
    expect(possessiveSuffix(1100)).toBe('ü'); // bin yüz
  });

  it('ignores sign and fraction; falls back to "i" for a non-finite value', () => {
    expect(possessiveSuffix(-42)).toBe('si');
    expect(possessiveSuffix(41.9)).toBe('i');
    expect(possessiveSuffix(Number.NaN)).toBe('i');
    expect(possessiveSuffix(Number.POSITIVE_INFINITY)).toBe('i');
  });

  it('possessive() adds the apostrophe', () => {
    expect(`%${42}${possessive(42)}`).toBe('%42’si');
    expect(`%${10}${possessive(10)}`).toBe('%10’u');
    expect(`%${100}${possessive(100)}`).toBe('%100’ü');
    expect(`%${0}${possessive(0)}`).toBe('%0’ı');
    expect(`%${3}${possessive(3)}`).toBe('%3’ü');
    expect(`%${6}${possessive(6)}`).toBe('%6’sı');
  });
});
