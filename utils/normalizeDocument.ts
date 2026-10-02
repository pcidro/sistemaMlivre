export type DocumentType = "CPF" | "CNPJ";

export interface NormalizedDocument {
  document: string | null;
  documentType: DocumentType | null;
}

/** Validação estrutural; não verifica os dígitos verificadores. */
export function normalizeDocument(value: string | null | undefined): string | null {
  if (!value || !/^[\d\s./-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

export function normalizeCustomerDocument(
  value: string | null | undefined,
  declaredType?: string | null,
): NormalizedDocument {
  const document = normalizeDocument(value);
  const documentType = document === null ? null : document.length === 11 ? "CPF" : "CNPJ";
  if (declaredType && declaredType !== documentType) {
    return { document: null, documentType: null };
  }
  return { document, documentType };
}
