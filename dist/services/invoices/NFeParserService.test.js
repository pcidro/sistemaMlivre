"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const NFeParserService_1 = require("./NFeParserService");
function fixture(name) {
    return (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, "fixtures", name), "utf8");
}
const withPhone = fixture("nfe-with-phone.xml");
const withoutPhone = fixture("nfe-without-phone.xml");
const prefixed = fixture("nfe-prefixed.xml");
const key = "35261000000000000100550010000001231000001234";
const parser = new NFeParserService_1.NFeParserService();
(0, node_test_1.test)("extrai chave, número, nome e telefone do destinatário no nfeProc", () => {
    strict_1.default.deepEqual(parser.parse(withPhone), {
        invoiceKey: key,
        invoiceNumber: "000000123",
        customerName: "Maria Fictícia & Família",
        phone: "11999990000",
        document: "00000000000", documentType: "CPF",
    });
});
(0, node_test_1.test)("NF-e sem telefone retorna null e mantém nome do destinatário", () => {
    const data = parser.parse(withoutPhone);
    strict_1.default.equal(data.phone, null);
    strict_1.default.equal(data.customerName, "João Fictício");
    strict_1.default.equal(data.invoiceKey, key);
    strict_1.default.equal(data.invoiceNumber, "123");
});
(0, node_test_1.test)("NF-e com prefixo de namespace e raiz NFe é reconhecida", () => {
    strict_1.default.deepEqual(parser.parse(prefixed), {
        invoiceKey: key,
        invoiceNumber: "123",
        customerName: "Ana Fictícia",
        phone: "21999990000",
        document: null, documentType: null,
    });
});
(0, node_test_1.test)("nfeProc com prefixo de namespace também é reconhecido", () => {
    const xml = withPhone
        .replace('xmlns="http://www.portalfiscal.inf.br/nfe"', 'xmlns:n="http://www.portalfiscal.inf.br/nfe"')
        .replace(/<(\/?)([A-Za-z][A-Za-z0-9]*)/g, "<$1n:$2");
    strict_1.default.equal(parser.parse(xml).customerName, "Maria Fictícia & Família");
});
(0, node_test_1.test)("telefone vazio ou em branco é opcional", () => {
    for (const tag of ["<fone/>", "<fone></fone>", "<fone>   </fone>"]) {
        strict_1.default.equal(parser.parse(withPhone.replace("<fone>11999990000</fone>", tag)).phone, null);
    }
});
(0, node_test_1.test)("telefone ausente não utiliza telefone do emitente", () => {
    strict_1.default.equal(parser.parse(withoutPhone).phone, null);
});
(0, node_test_1.test)("ausência de enderDest não impede extração dos demais campos", () => {
    const xml = withoutPhone.replace(/<enderDest>[\s\S]*?<\/enderDest>/, "");
    strict_1.default.equal(parser.parse(xml).phone, null);
    strict_1.default.equal(parser.parse(xml).customerName, "João Fictício");
});
(0, node_test_1.test)("preserva zeros iniciais no telefone e não converte chave em número", () => {
    const data = parser.parse(withPhone.replace("11999990000", "011999990000"));
    strict_1.default.equal(data.phone, "011999990000");
    strict_1.default.equal(data.invoiceKey, key);
});
(0, node_test_1.test)("nome com espaços ou CDATA é extraído como texto", () => {
    const xml = withPhone.replace("Maria Fictícia &amp; Família", "<![CDATA[  Cliente   Fictício  ]]>");
    strict_1.default.equal(parser.parse(xml).customerName, "Cliente Fictício");
});
(0, node_test_1.test)("nome ausente retorna null sem buscar nome do emitente", () => {
    const xml = withoutPhone.replace("<xNome>João Fictício</xNome>", "");
    strict_1.default.equal(parser.parse(xml).customerName, null);
});
(0, node_test_1.test)("usa chNFe do protocolo quando atributo Id não é fornecido", () => {
    strict_1.default.equal(parser.parse(withPhone.replace(` Id="NFe${key}"`, "")).invoiceKey, key);
});
(0, node_test_1.test)("recusa divergência entre chave do Id e do protocolo", () => {
    const xml = withPhone.replace(`<chNFe>${key}</chNFe>`, `<chNFe>${"9".repeat(44)}</chNFe>`);
    strict_1.default.throws(() => parser.parse(xml), NFeParserService_1.NFeParserError);
});
(0, node_test_1.test)("recusa XML truncado, vazio, texto e documento diferente de NF-e", () => {
    for (const xml of ["", "   ", "texto", "<NFe><infNFe></NFe>", "<html>erro</html>"]) {
        strict_1.default.throws(() => parser.parse(xml), NFeParserService_1.NFeParserError);
    }
});
(0, node_test_1.test)("recusa chave inválida, chave ausente e número ausente", () => {
    for (const xml of [
        withoutPhone.replace(`NFe${key}`, "NFe123"),
        withoutPhone.replace(` Id="NFe${key}"`, ""),
        withoutPhone.replace("<nNF>123</nNF>", ""),
    ]) {
        strict_1.default.throws(() => parser.parse(xml), NFeParserService_1.NFeParserError);
    }
});
(0, node_test_1.test)("recusa NFC-e modelo 65 e documentos em lote", () => {
    strict_1.default.throws(() => parser.parse(withoutPhone.replace("<mod>55</mod>", "<mod>65</mod>")), NFeParserService_1.NFeParserError);
    const nfe = /<NFe>[\s\S]*?<\/NFe>/.exec(withoutPhone)?.[0];
    strict_1.default.ok(nfe);
    strict_1.default.throws(() => parser.parse(`<nfeProc>${nfe}${nfe}</nfeProc>`), NFeParserService_1.NFeParserError);
});
(0, node_test_1.test)("recusa DTD e entidades customizadas sem expor conteúdo em erros", () => {
    const xml = '<!DOCTYPE NFe [<!ENTITY private "dado-pessoal-ficticio">]><NFe>&private;</NFe>';
    strict_1.default.throws(() => parser.parse(xml), (error) => {
        strict_1.default.ok(error instanceof NFeParserService_1.NFeParserError);
        strict_1.default.equal(error.statusCode, 422);
        strict_1.default.ok(!error.message.includes("dado-pessoal-ficticio"));
        return true;
    });
    strict_1.default.throws(() => parser.parse("<NFe><dado-pessoal-ficticio></NFe>"), (error) => {
        strict_1.default.ok(error instanceof NFeParserService_1.NFeParserError);
        strict_1.default.ok(!error.message.includes("dado-pessoal-ficticio"));
        return true;
    });
});
(0, node_test_1.test)("recusa XML acima do limite em bytes", () => {
    strict_1.default.throws(() => parser.parse("á".repeat(NFeParserService_1.MAX_NFE_XML_BYTES / 2 + 1)), NFeParserService_1.NFeParserError);
});
(0, node_test_1.test)("resultado contém somente os campos necessários, sem XML", () => {
    strict_1.default.deepEqual(Object.keys(parser.parse(withPhone)).sort(), [
        "customerName", "document", "documentType", "invoiceKey", "invoiceNumber", "phone",
    ]);
});
(0, node_test_1.test)("extrai CPF do destinatário e preserva zeros iniciais", () => {
    const data = parser.parse(withPhone.replace("<CPF>00000000000</CPF>", "<CPF>00123456789</CPF>"));
    strict_1.default.equal(data.document, "00123456789");
    strict_1.default.equal(data.documentType, "CPF");
});
(0, node_test_1.test)("extrai CNPJ do destinatário e não o do emitente", () => {
    const data = parser.parse(withPhone.replace("<CPF>00000000000</CPF>", "<CNPJ>12345678000190</CNPJ>"));
    strict_1.default.equal(data.document, "12345678000190");
    strict_1.default.equal(data.documentType, "CNPJ");
});
(0, node_test_1.test)("documento ausente, inválido ou ambíguo retorna null sem interromper parsing", () => {
    for (const tag of ["", "<CPF/>", "<CPF>123</CPF>", "<CPF>12345678000190</CPF>",
        "<CPF>12345678900</CPF><CNPJ>12345678000190</CNPJ>"]) {
        const data = parser.parse(withPhone.replace("<CPF>00000000000</CPF>", tag));
        strict_1.default.equal(data.document, null);
        strict_1.default.equal(data.documentType, null);
        strict_1.default.equal(data.customerName, "Maria Fictícia & Família");
    }
});
(0, node_test_1.test)("CPF e CNPJ com namespace prefixado são reconhecidos", () => {
    for (const [type, value] of [["CPF", "00123456789"], ["CNPJ", "12345678000190"]]) {
        const data = parser.parse(prefixed.replace("<nfe:dest>", `<nfe:dest><nfe:${type}>${value}</nfe:${type}>`));
        strict_1.default.equal(data.document, value);
        strict_1.default.equal(data.documentType, type);
    }
});
//# sourceMappingURL=NFeParserService.test.js.map