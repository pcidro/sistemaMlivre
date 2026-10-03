import type { MarketplaceCustomer } from "../../integrations/types";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
import { normalizePhone } from "../../utils/normalizePhone";

export type NormalizedCustomerData = MarketplaceCustomer & NormalizedDocument;

export function normalizeCustomerData(customer: MarketplaceCustomer): NormalizedCustomerData {
  return {
    name: customer.name?.trim().replace(/\s+/g, " ") || null,
    phone: normalizePhone(customer.phone),
    ...normalizeCustomerDocument(customer.document, customer.documentType),
  };
}

/** Completa ausências, preservando documento e tipo como um par indivisível. */
export function mergeCustomerData(primary: MarketplaceCustomer, fallback: MarketplaceCustomer): NormalizedCustomerData {
  const customer = normalizeCustomerData(primary);
  const secondary = normalizeCustomerData(fallback);
  return {
    name: customer.name ?? secondary.name,
    phone: customer.phone ?? secondary.phone,
    document: customer.document ?? secondary.document,
    documentType: customer.document !== null ? customer.documentType : secondary.documentType,
  };
}
