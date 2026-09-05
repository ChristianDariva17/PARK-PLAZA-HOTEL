declare const moneyCentsBrand: unique symbol;
export type MoneyCents = bigint & { readonly [moneyCentsBrand]: 'MoneyCents' };

declare const moneyStringBrand: unique symbol;
export type MoneyString = string & { readonly [moneyStringBrand]: 'MoneyString' };

export const ZERO_MONEY = 0n as MoneyCents;

export function parseMoney(value: string): MoneyCents {
  if (!/^[-]?\d+\.\d{2}$/.test(value)) {
    throw new Error('Invalid money format. Must be a canonical decimal string with two decimal places (e.g., "10.50").');
  }
  const isNegative = value.startsWith('-');
  const cleanValue = isNegative ? value.slice(1) : value;
  const parts = cleanValue.split('.');
  if ((parts[0] || '').length > 12) {
    throw new Error('Money value out of range. Maximum allowed is 12 integer digits.');
  }
  const cents = BigInt((parts[0] || '') + (parts[1] || ''));
  return (isNegative ? -cents : cents) as MoneyCents;
}

export function formatMoney(value: MoneyCents): MoneyString {
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  const asString = absValue.toString().padStart(3, '0');
  const integerPart = asString.slice(0, asString.length - 2);
  const decimalPart = asString.slice(asString.length - 2);
  const formatted = `${isNegative ? '-' : ''}${integerPart}.${decimalPart}`;
  return formatted as MoneyString;
}

export function addMoney(a: MoneyCents, b: MoneyCents): MoneyCents {
  return (a + b) as MoneyCents;
}

export function subtractMoney(a: MoneyCents, b: MoneyCents): MoneyCents {
  return (a - b) as MoneyCents;
}

export function compareMoney(a: MoneyCents, b: MoneyCents): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
