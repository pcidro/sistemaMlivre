import type { MarketplaceCustomer } from "../../integrations/types";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
import { NFeParserService } from "../invoices/NFeParserService";
export interface CustomerExtractionSources {
    getRecipient(): Promise<MarketplaceCustomer>;
    getInvoiceXml(): Promise<string | null>;
}
/** Combina dados do pedido/envio e da NF-e, sem persistência. */
export declare class CustomerExtractionService {
    private readonly nfeParser;
    constructor(nfeParser?: Pick<NFeParserService, "parse">);
    extract(sources: CustomerExtractionSources): Promise<MarketplaceCustomer & NormalizedDocument>;
}
//# sourceMappingURL=CustomerExtractionService.d.ts.map