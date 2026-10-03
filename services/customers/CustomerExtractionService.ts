import type { MarketplaceCustomer } from "../../integrations/types";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
import { NFeParserService } from "../invoices/NFeParserService";
import { mergeCustomerData, normalizeCustomerData } from "./customerData";

export interface CustomerExtractionSources {
  getRecipient(): Promise<MarketplaceCustomer>;
  getInvoiceXml(): Promise<string | null>;
}

/** Combina dados do pedido/envio e da NF-e, sem persistência. */
export class CustomerExtractionService {
  constructor(
    private readonly nfeParser: Pick<NFeParserService, "parse"> = new NFeParserService(),
  ) {}

  async extract(sources: CustomerExtractionSources): Promise<MarketplaceCustomer & NormalizedDocument> {
    const recipient = await sources.getRecipient();
    const customer = normalizeCustomerData(recipient);

    if (customer.phone !== null && customer.document !== null) return customer;

    const xml = await sources.getInvoiceXml();
    if (xml === null) return customer;

    const invoice = this.nfeParser.parse(xml);
    return mergeCustomerData(customer, {
      name: invoice.customerName, phone: invoice.phone,
      document: invoice.document, documentType: invoice.documentType,
    });
  }
}
