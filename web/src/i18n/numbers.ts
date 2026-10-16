const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function localizeNumbers(value: string | number, lang: 'en' | 'ar'): string {
  if (lang !== 'ar') return String(value);
  return String(value)
    .replace(/\d/g, (d) => AR_DIGITS[+d])
    .replace(/\bAM\b/g, 'ص')
    .replace(/\bPM\b/g, 'م');
}

export function formatPhone(raw: string, lang: 'en' | 'ar'): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, '');
  let out = raw.trim();
  if (digits.startsWith('961')) {
    const rest = digits.slice(3);                 // e.g. "81123476"
    const groups = [rest.slice(0, 2), rest.slice(2, 5), rest.slice(5)].filter(Boolean);
    out = `+961 ${groups.join(' ')}`;             // "+961 81 123 476"
  }
  return localizeNumbers(out, lang);              // digits → ٠-٩
}