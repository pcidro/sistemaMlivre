const BRAZIL_COUNTRY_CODE = "55";
const BRAZILIAN_PHONE_LENGTHS = new Set([10, 11]);

/**
 * Normaliza um telefone brasileiro para o formato internacional somente com
 * dígitos. Retorna null quando não há informação suficiente para reconhecer
 * um número brasileiro com DDD.
 */
export function normalizePhone(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  let digits = value.replace(/\D/g, "");

  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (
    digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    BRAZILIAN_PHONE_LENGTHS.has(digits.length - BRAZIL_COUNTRY_CODE.length)
  ) {
    return digits;
  }

  if (digits.startsWith("0") && BRAZILIAN_PHONE_LENGTHS.has(digits.length - 1)) {
    digits = digits.slice(1);
  }

  if (!BRAZILIAN_PHONE_LENGTHS.has(digits.length)) {
    return null;
  }

  return `${BRAZIL_COUNTRY_CODE}${digits}`;
}
