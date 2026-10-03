import { readFileSync } from "node:fs";
import { join } from "node:path";

const fixtureXml = readFileSync(join(__dirname, "../../../services/invoices/fixtures/nfe-with-phone.xml"), "utf8");
export const invoiceFixtureKey = "35261000000000000100550010000001231000001234";
export const secondInvoiceFixtureKey = "35261000000000000100550010000001241000001234";
export const invoiceFixtureCpf = "00000000000";
export const invoiceFixtureCnpj = "00000000000000";

/** Dados fictícios sem validade fiscal, derivados do fixture do parser compartilhado. */
export function invoiceFixture(options: {
  key?: string;
  document?: string | null;
  cnpj?: boolean;
  phone?: boolean;
  status?: string;
} = {}) {
  const key = options.key ?? invoiceFixtureKey;
  let xml = fixtureXml.replaceAll(invoiceFixtureKey, key);
  const documentTag = options.document === null ? "" : options.cnpj
    ? `<CNPJ>${options.document ?? invoiceFixtureCnpj}</CNPJ>`
    : `<CPF>${options.document ?? invoiceFixtureCpf}</CPF>`;
  xml = xml.replace(`<CPF>${invoiceFixtureCpf}</CPF>`, documentTag);
  if (options.phone === false) xml = xml.replace("<fone>11999990000</fone>", "");
  return { key, status: options.status ?? "approved", issued_at: "2025-03-14T18:12:20.312653", xml };
}
