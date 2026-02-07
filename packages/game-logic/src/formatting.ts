import { Locale } from '@openthrone/shared';

/**
 * Converts a number, string, or bigint to a locale-formatted string.
 * Large numbers are automatically converted to human-readable form (e.g. "1.234 Billion").
 */
export const toLocale = (
  num: number | string | bigint,
  locale?: Locale,
): string => {
  if (typeof num === 'number') {
    return num.toLocaleString(locale || undefined);
  } else if (typeof num === 'string') {
    let parsedBigInt: bigint | undefined;
    try {
      parsedBigInt = BigInt(num.replace(/,/g, ''));
      if (num.length > 10) return convertToHumanReadable(parsedBigInt, locale);
      if (parsedBigInt <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(parsedBigInt).toLocaleString(locale || undefined);
      }
    } catch (_e) {
      // Not a valid BigInt, attempt Number parsing
    }

    const parsedNum = parseInt(num.replace(/,/g, ''), 10);
    return isNaN(parsedNum)
      ? '0'
      : parsedNum.toLocaleString(locale || undefined);
  } else if (typeof num === 'bigint') {
    return convertToHumanReadable(num, locale);
  }
  return '0';
};

/**
 * Parses a locale-formatted string back into a number or bigint.
 */
export const fromLocale = (
  str: string,
  locale?: Locale,
): bigint | number => {
  const localeSeparators: Record<string, { decimal: string; thousands: string }> = {
    'en-US': { decimal: '.', thousands: ',' },
    'es-ES': { decimal: ',', thousands: '.' },
  };

  const { decimal, thousands } = localeSeparators[locale || 'en-US'] ?? {
    decimal: '.',
    thousands: ',',
  };

  // Remove thousands separators
  const normalizedStr = str.replace(new RegExp(`\\${thousands}`, 'g'), '');

  // Replace the decimal separator with a period
  const cleanedStr = normalizedStr.replace(decimal, '.');

  // Attempt to convert to BigInt or Number
  try {
    return BigInt(cleanedStr);
  } catch (_e) {
    return parseFloat(cleanedStr);
  }
};

/**
 * Converts a bigint to a human-readable string with named magnitudes
 * (e.g. "1.234 Billion", "5.678 Trillion").
 */
export const convertToHumanReadable = (
  num: bigint,
  locale?: Locale,
): string => {
  const names = [
    { value: 1e9, name: 'Billion' },
    { value: 1e12, name: 'Trillion' },
    { value: 1e15, name: 'Quadrillion' },
    { value: 1e18, name: 'Quintillion' },
    { value: 1e21, name: 'Sextillion' },
    { value: 1e24, name: 'Septillion' },
    { value: 1e27, name: 'Octillion' },
  ];

  for (let i = names.length - 1; i >= 0; i--) {
    const entry = names[i];
    if (entry && num >= BigInt(entry.value)) {
      const result = Number(num / BigInt(entry.value)).toLocaleString(
        locale || undefined,
        { minimumFractionDigits: 3, maximumFractionDigits: 3 },
      );
      return `${result} ${entry.name}`;
    }
  }
  // Fallback for numbers smaller than 1 billion
  return Number(num).toLocaleString(locale || undefined);
};

/**
 * Recursively converts all bigint values in an object to strings.
 * Mutates and returns the same object reference.
 */
export const stringifyObj = <T extends Record<string, unknown>>(obj: T): T => {
  for (const key in obj) {
    if (typeof obj[key] === 'bigint') {
      (obj as Record<string, unknown>)[key] = (obj[key] as bigint).toString();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      stringifyObj(obj[key] as Record<string, unknown>);
    }
  }
  return obj;
};
