import type { MagaluCustomer, MagaluOrder, MagaluOrderResponse } from "../magaluOrder.types";

// Dados sintéticos exclusivos dos testes; documentos sem validade fiscal.
function order(customer: MagaluCustomer): MagaluOrder {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code: "0000000000000001",
    status: "approved",
    created_at: "2026-09-01T09:00:00+00:00",
    purchased_at: "2026-09-01T07:00:00-03:00",
    customer,
    deliveries: [{
      id: "00000000-0000-4000-8000-000000000002",
      code: "0000000000000001-1",
      status: "invoiced",
      items: [{
        info: {
          id: "00000000-0000-4000-8000-000000000003",
          sku: "TESTE-001",
          name: "Produto de teste",
        },
        quantity: 2,
        unit_price: { currency: "BRL", normalizer: 100, value: 1990 },
      }],
    }],
  };
}

export const magaluOrderFixtures = {
  cpf: order({ name: "Cliente CPF de teste", document_number: "000.000.000-00", customer_type: "cpf" }),
  cnpj: order({ name: "Empresa de teste", document_number: "00.000.000/0000-00", customer_type: "cnpj" }),
  mobile: order({
    name: "Cliente com celular",
    email: "cliente@example.invalid",
    phones: [{ country_code: "+55", area_code: "11", number: "90000-0001", type: "mobile" }],
  }),
  multiplePhones: order({
    name: "Cliente com vários telefones",
    phones: [
      { country_code: "55", area_code: "11", number: "30000001", type: "residential" },
      { country_code: "55", area_code: "11", number: "30000002", type: "comercial" },
      { country_code: "55", area_code: "21", number: "900000003", type: "mobile" },
      { country_code: "55", area_code: "31", number: "900000004", type: "mobile" },
    ],
  }),
  noPhone: order({ name: "Cliente sem telefone", document_number: "00000000000", customer_type: "cpf", phones: [] }),
  noDocument: order({ name: "Cliente sem documento", document_number: null, customer_type: null }),
} satisfies Record<string, MagaluOrder>;

export const magaluOrderResponseFixture: MagaluOrderResponse = {
  meta: {
    links: { self: "?_offset=0&_limit=20", next: null, previous: null },
    page: { count: 6, limit: 20, max_limit: 100, offset: 0 },
  },
  results: Object.values(magaluOrderFixtures),
};
