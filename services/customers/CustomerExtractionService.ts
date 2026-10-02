import type { MarketplaceCustomer } from "../../integrations/types";
import { normalizePhone } from "../../utils/normalizePhone";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
import { NFeParserService } from "../invoices/NFeParserService";

export interface CustomerExtractionSources {
  getRecipient(): Promise<MarketplaceCustomer>;
  getInvoiceXml(): Promise<string | null>;
}

function normalizeName(value: string | null): string | null {
  return value?.trim().replace(/\s+/g, " ") || null;
}

/** Combina dados do pedido/envio e da NF-e, sem persistência. */
export class CustomerExtractionService {
  constructor(
    private readonly nfeParser: Pick<NFeParserService, "parse"> = new NFeParserService(),
  ) {}

  async extract(sources: CustomerExtractionSources): Promise<MarketplaceCustomer & NormalizedDocument> {
    const recipient = await sources.getRecipient();
    const customer = {
      name: normalizeName(recipient.name),
      phone: normalizePhone(recipient.phone),
      ...normalizeCustomerDocument(recipient.document, recipient.documentType),
    };

    if (customer.phone !== null && customer.document !== null) return customer;

    const xml = await sources.getInvoiceXml();
    if (xml === null) return customer;

    const invoice = this.nfeParser.parse(xml);
    const invoiceDocument = normalizeCustomerDocument(invoice.document, invoice.documentType);

    return {
      name: customer.name ?? normalizeName(invoice.customerName),
      phone: customer.phone ?? normalizePhone(invoice.phone),
      ...(customer.document !== null ? {
        document: customer.document, documentType: customer.documentType,
      } : invoiceDocument),
    };
  }
}
