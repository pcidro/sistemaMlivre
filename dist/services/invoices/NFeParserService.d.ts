import { AppError } from "../../errors/AppError";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
export declare const MAX_NFE_XML_BYTES: number;
export interface ParsedNFeData extends NormalizedDocument {
    invoiceKey: string;
    invoiceNumber: string;
    customerName: string | null;
    phone: string | null;
}
export declare class NFeParserError extends AppError {
    constructor(message?: string);
}
/** Extrai dados de uma NF-e modelo 55; não verifica assinatura nem autorização SEFAZ. */
export declare class NFeParserService {
    parse(xml: string): ParsedNFeData;
}
//# sourceMappingURL=NFeParserService.d.ts.map