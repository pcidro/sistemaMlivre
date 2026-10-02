export type DocumentType = "CPF" | "CNPJ";
export interface NormalizedDocument {
    document: string | null;
    documentType: DocumentType | null;
}
/** Validação estrutural; não verifica os dígitos verificadores. */
export declare function normalizeDocument(value: string | null | undefined): string | null;
export declare function normalizeCustomerDocument(value: string | null | undefined, declaredType?: string | null): NormalizedDocument;
//# sourceMappingURL=normalizeDocument.d.ts.map