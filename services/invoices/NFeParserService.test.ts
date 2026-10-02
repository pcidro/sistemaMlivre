import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { MAX_NFE_XML_BYTES, NFeParserError, NFeParserService } from "./NFeParserService";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

const withPhone = fixture("nfe-with-phone.xml");
const withoutPhone = fixture("nfe-without-phone.xml");
const prefixed = fixture("nfe-prefixed.xml");
const key = "35261000000000000100550010000001231000001234";
const parser = new NFeParserService();

test("extrai chave, número, nome e telefone do destinatário no nfeProc", () => {
  assert.deepEqual(parser.parse(withPhone), {
    invoiceKey: key,
    invoiceNumber: "000000123",
    customerName: "Maria Fictícia & Família",
    phone: "11999990000",
    document: "00000000000", documentType: "CPF",
  });
});

test("NF-e sem telefone retorna null e mantém nome do destinatário", () => {
  const data = parser.parse(withoutPhone);
  assert.equal(data.phone, null);
  assert.equal(data.customerName, "João Fictício");
  assert.equal(data.invoiceKey, key);
  assert.equal(data.invoiceNumber, "123");
});

test("NF-e com prefixo de namespace e raiz NFe é reconhecida", () => {
  assert.deepEqual(parser.parse(prefixed), {
    invoiceKey: key,
    invoiceNumber: "123",
    customerName: "Ana Fictícia",
    phone: "21999990000",
    document: null, documentType: null,
  });
});

test("nfeProc com prefixo de namespace também é reconhecido", () => {
  const xml = withPhone
    .replace('xmlns="http://www.portalfiscal.inf.br/nfe"', 'xmlns:n="http://www.portalfiscal.inf.br/nfe"')
    .replace(/<(\/?)([A-Za-z][A-Za-z0-9]*)/g, "<$1n:$2");
  assert.equal(parser.parse(xml).customerName, "Maria Fictícia & Família");
});

test("telefone vazio ou em branco é opcional", () => {
  for (const tag of ["<fone/>", "<fone></fone>", "<fone>   </fone>"]) {
    assert.equal(parser.parse(withPhone.replace("<fone>11999990000</fone>", tag)).phone, null);
  }
});

test("telefone ausente não utiliza telefone do emitente", () => {
  assert.equal(parser.parse(withoutPhone).phone, null);
});

test("ausência de enderDest não impede extração dos demais campos", () => {
  const xml = withoutPhone.replace(/<enderDest>[\s\S]*?<\/enderDest>/, "");
  assert.equal(parser.parse(xml).phone, null);
  assert.equal(parser.parse(xml).customerName, "João Fictício");
});

test("preserva zeros iniciais no telefone e não converte chave em número", () => {
  const data = parser.parse(withPhone.replace("11999990000", "011999990000"));
  assert.equal(data.phone, "011999990000");
  assert.equal(data.invoiceKey, key);
});

test("nome com espaços ou CDATA é extraído como texto", () => {
  const xml = withPhone.replace("Maria Fictícia &amp; Família", "<![CDATA[  Cliente   Fictício  ]]>");
  assert.equal(parser.parse(xml).customerName, "Cliente Fictício");
});

test("nome ausente retorna null sem buscar nome do emitente", () => {
  const xml = withoutPhone.replace("<xNome>João Fictício</xNome>", "");
  assert.equal(parser.parse(xml).customerName, null);
});

test("usa chNFe do protocolo quando atributo Id não é fornecido", () => {
  assert.equal(parser.parse(withPhone.replace(` Id="NFe${key}"`, "")).invoiceKey, key);
});

test("recusa divergência entre chave do Id e do protocolo", () => {
  const xml = withPhone.replace(`<chNFe>${key}</chNFe>`, `<chNFe>${"9".repeat(44)}</chNFe>`);
  assert.throws(() => parser.parse(xml), NFeParserError);
});

test("recusa XML truncado, vazio, texto e documento diferente de NF-e", () => {
  for (const xml of ["", "   ", "texto", "<NFe><infNFe></NFe>", "<html>erro</html>"]) {
    assert.throws(() => parser.parse(xml), NFeParserError);
  }
});

test("recusa chave inválida, chave ausente e número ausente", () => {
  for (const xml of [
    withoutPhone.replace(`NFe${key}`, "NFe123"),
    withoutPhone.replace(` Id="NFe${key}"`, ""),
    withoutPhone.replace("<nNF>123</nNF>", ""),
  ]) {
    assert.throws(() => parser.parse(xml), NFeParserError);
  }
});

test("recusa NFC-e modelo 65 e documentos em lote", () => {
  assert.throws(() => parser.parse(withoutPhone.replace("<mod>55</mod>", "<mod>65</mod>")), NFeParserError);
  const nfe = /<NFe>[\s\S]*?<\/NFe>/.exec(withoutPhone)?.[0];
  assert.ok(nfe);
  assert.throws(() => parser.parse(`<nfeProc>${nfe}${nfe}</nfeProc>`), NFeParserError);
});

test("recusa DTD e entidades customizadas sem expor conteúdo em erros", () => {
  const xml = '<!DOCTYPE NFe [<!ENTITY private "dado-pessoal-ficticio">]><NFe>&private;</NFe>';
  assert.throws(() => parser.parse(xml), (error: unknown) => {
    assert.ok(error instanceof NFeParserError);
    assert.equal(error.statusCode, 422);
    assert.ok(!error.message.includes("dado-pessoal-ficticio"));
    return true;
  });
  assert.throws(() => parser.parse("<NFe><dado-pessoal-ficticio></NFe>"), (error: unknown) => {
    assert.ok(error instanceof NFeParserError);
    assert.ok(!error.message.includes("dado-pessoal-ficticio"));
    return true;
  });
});

test("recusa XML acima do limite em bytes", () => {
  assert.throws(() => parser.parse("á".repeat(MAX_NFE_XML_BYTES / 2 + 1)), NFeParserError);
});

test("resultado contém somente os campos necessários, sem XML", () => {
  assert.deepEqual(Object.keys(parser.parse(withPhone)).sort(), [
    "customerName", "document", "documentType", "invoiceKey", "invoiceNumber", "phone",
  ]);
});

test("extrai CPF do destinatário e preserva zeros iniciais", () => {
  const data = parser.parse(withPhone.replace("<CPF>00000000000</CPF>", "<CPF>00123456789</CPF>"));
  assert.equal(data.document, "00123456789");
  assert.equal(data.documentType, "CPF");
});

test("extrai CNPJ do destinatário e não o do emitente", () => {
  const data = parser.parse(withPhone.replace("<CPF>00000000000</CPF>", "<CNPJ>12345678000190</CNPJ>"));
  assert.equal(data.document, "12345678000190");
  assert.equal(data.documentType, "CNPJ");
});

test("documento ausente, inválido ou ambíguo retorna null sem interromper parsing", () => {
  for (const tag of ["", "<CPF/>", "<CPF>123</CPF>", "<CPF>12345678000190</CPF>",
    "<CPF>12345678900</CPF><CNPJ>12345678000190</CNPJ>"]) {
    const data = parser.parse(withPhone.replace("<CPF>00000000000</CPF>", tag));
    assert.equal(data.document, null);
    assert.equal(data.documentType, null);
    assert.equal(data.customerName, "Maria Fictícia & Família");
  }
});

test("CPF e CNPJ com namespace prefixado são reconhecidos", () => {
  for (const [type, value] of [["CPF", "00123456789"], ["CNPJ", "12345678000190"]]) {
    const data = parser.parse(prefixed.replace("<nfe:dest>", `<nfe:dest><nfe:${type}>${value}</nfe:${type}>`));
    assert.equal(data.document, value);
    assert.equal(data.documentType, type);
  }
});
