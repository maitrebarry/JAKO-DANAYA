// Map of country ISO code to expected national phone number lengths (without country code)
// Values can be array to allow multiple valid lengths. Add/update as needed.
const PHONE_RULES: Record<string, number[] | null> = {
  ML: [8], // Mali: 8 digits
  GN: [9], // Guinea: 9 digits
  SN: [9], // Senegal: 9 digits
  CI: [8], // Cote d'Ivoire: 8 digits
  BF: [8], // Burkina Faso (example)
  GM: [7], // Gambia (example)
  US: [10], // United States
  FR: [9], // France (national without leading 0; this is simplistic)
  GB: [10],
  // Add more exact rules as needed
};

export function getExpectedNationalLengths(codeIso?: string): number[] | null {
  if (!codeIso) return null;
  const k = (codeIso || '').toUpperCase();
  return PHONE_RULES[k] || null;
}

export function isNationalNumberValid(codeIso: string | undefined, nationalNumber: string | undefined): boolean | null {
  if (!codeIso) return null;
  const lens = getExpectedNationalLengths(codeIso);
  if (!lens) return null; // unknown rule
  if (!nationalNumber) return false;
  const cleaned = nationalNumber.replace(/\D/g, '');
  return lens.includes(cleaned.length);
}
