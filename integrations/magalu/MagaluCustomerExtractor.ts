import { AppError } from "../../errors/AppError";
import { normalizePhone } from "../../utils/normalizePhone";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import type { NormalizedDocument } from "../../utils/normalizeDocument";
import type { MarketplaceCustomer } from "../types";
import { magaluOrderSchema } from "./magaluOrder.types";
import type { MagaluCustomer, MagaluPhone } from "./magaluOrder.types";

const sourceSchema = magaluOrderSchema.pick({ customer: true });

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function phoneValue(phone: MagaluPhone): string | null {
  const number = text(phone.number);
  if (!number || !/^[+\d\s().-]+$/.test(number)) return null;

  const country = text(phone.country_code);
  // O normalizador compartilhado suporta apenas telefones brasileiros.
  if (country && !["55", "+55", "0055"].includes(country)) return null;

  const internationalPrefix = /^(?:\+|00)/.test(number);
  if (internationalPrefix && !/^(?:\+55|0055)/.test(number)) return null;

  const area = text(phone.area_code);
  if (area && !/^\d{2}$/.test(area)) return null;

  // Se number já tem DDD ou DDI+DDD, usar o normalizador antes de adicionar
  // componentes. Um prefixo 55 sozinho não prova DDI: também existe o DDD 55.
  const complete = normalizePhone(number);
  if (internationalPrefix) {
    const digits = number.replace(/\D/g, "");
    const international = digits.startsWith("00") ? digits.slice(2) : digits;
    if (complete !== international) return null;
  }
  if (complete) {
    // Campos contraditórios não devem produzir um telefone presumido.
    return area && complete.slice(2, 4) !== area ? null : complete;
  }

  return normalizePhone(`${country ?? ""}${area ?? ""}${number}`);
}

function phonePriority(phone: MagaluPhone): number {
  switch (phone.type?.trim().toLowerCase()) {
    case "mobile": return 0;
    case "comercial":
    case "residential": return 1;
    default: return 2;
  }
}

function selectPhone(phones: MagaluCustomer["phones"]): string | null {
  let selected: string | null = null;
  let priority = Infinity;
  for (const phone of phones ?? []) {
    const normalized = phoneValue(phone);
    const candidatePriority = phonePriority(phone);
    if (normalized !== null && candidatePriority < priority) {
      selected = normalized;
      priority = candidatePriority;
    }
  }
  return selected;
}

/** Extração pura de order.customer; não consulta NF-e, API ou banco. */
export class MagaluCustomerExtractor {
  extract(order: unknown): MarketplaceCustomer & NormalizedDocument {
    const parsed = sourceSchema.safeParse(order);
    if (!parsed.success) {
      throw new AppError("A Magalu retornou dados de cliente com estrutura inválida", 502);
    }
    const customer = parsed.data.customer;
    const type = text(customer?.customer_type)?.toUpperCase();
    const recognizedType = type === "CPF" || type === "CNPJ";
    // Esse helper já chama normalizeDocument e verifica o tipo declarado.
    // Sem tipo, mantém a inferência estrutural existente; tipo desconhecido
    // não deve ser convertido em CPF/CNPJ por suposição.
    const document: NormalizedDocument = type && !recognizedType
      ? { document: null, documentType: null }
      : normalizeCustomerDocument(customer?.document_number, type);

    return {
      name: text(customer?.name),
      phone: selectPhone(customer?.phones),
      ...document,
    };
  }
}
