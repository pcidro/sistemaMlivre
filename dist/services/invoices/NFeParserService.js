"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NFeParserService = exports.NFeParserError = exports.MAX_NFE_XML_BYTES = void 0;
const node_buffer_1 = require("node:buffer");
const fast_xml_parser_1 = require("fast-xml-parser");
const zod_1 = require("zod");
const AppError_1 = require("../../errors/AppError");
const normalizeDocument_1 = require("../../utils/normalizeDocument");
exports.MAX_NFE_XML_BYTES = 5 * 1024 * 1024;
class NFeParserError extends AppError_1.AppError {
    constructor(message = "XML da NF-e inválido") {
        super(message, 422);
        Object.setPrototypeOf(this, NFeParserError.prototype);
        this.name = "NFeParserError";
    }
}
exports.NFeParserError = NFeParserError;
const invoiceKeySchema = zod_1.z.string().regex(/^\d{44}$/);
const optionalTextSchema = zod_1.z.string().optional();
const nfeSchema = zod_1.z.object({
    infNFe: zod_1.z.object({
        "@_Id": zod_1.z.string().optional(),
        ide: zod_1.z.object({
            mod: zod_1.z.literal("55"),
            nNF: zod_1.z.string().regex(/^\d{1,9}$/),
        }),
        dest: zod_1.z.object({
            xNome: optionalTextSchema,
            CPF: optionalTextSchema,
            CNPJ: optionalTextSchema,
            enderDest: zod_1.z.object({ fone: optionalTextSchema }).optional(),
        }),
    }),
});
const processedNfeSchema = zod_1.z.object({
    NFe: nfeSchema,
    protNFe: zod_1.z
        .object({ infProt: zod_1.z.object({ chNFe: invoiceKeySchema }) })
        .optional(),
});
const documentSchema = zod_1.z.union([
    zod_1.z.object({ nfeProc: processedNfeSchema }).strict(),
    zod_1.z.object({ NFe: nfeSchema }).strict(),
]);
function optionalText(value) {
    return value?.trim() || null;
}
/** Extrai dados de uma NF-e modelo 55; não verifica assinatura nem autorização SEFAZ. */
class NFeParserService {
    parse(xml) {
        if (!xml.trim())
            throw new NFeParserError();
        if (node_buffer_1.Buffer.byteLength(xml, "utf8") > exports.MAX_NFE_XML_BYTES) {
            throw new NFeParserError("XML da NF-e excede o limite de tamanho");
        }
        // NF-e não precisa de DTD. Recusá-lo impede expansão de entidades arbitrárias.
        if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
            throw new NFeParserError("Declarações DTD não são permitidas na NF-e");
        }
        let document;
        try {
            if (fast_xml_parser_1.XMLValidator.validate(xml) !== true)
                throw new Error();
            const parser = new fast_xml_parser_1.XMLParser({
                ignoreAttributes: false,
                removeNSPrefix: true,
                parseTagValue: false,
                parseAttributeValue: false,
                trimValues: true,
                ignoreDeclaration: true,
                ignorePiTags: true,
                maxNestedTags: 100,
            });
            const parsed = parser.parse(xml);
            document = documentSchema.parse(parsed);
        }
        catch {
            // Nunca repassar mensagens da biblioteca: elas podem conter o XML recebido.
            throw new NFeParserError();
        }
        const processed = "nfeProc" in document ? document.nfeProc : null;
        const nfe = "NFe" in document ? document.NFe : document.nfeProc.NFe;
        const info = nfe.infNFe;
        const id = info["@_Id"];
        const idKey = id === undefined ? null : /^NFe(\d{44})$/.exec(id)?.[1];
        const protocolKey = processed?.protNFe?.infProt.chNFe ?? null;
        if (id !== undefined && !idKey)
            throw new NFeParserError();
        if (idKey && protocolKey && idKey !== protocolKey) {
            throw new NFeParserError("Chaves da NF-e e do protocolo são diferentes");
        }
        const invoiceKey = idKey ?? protocolKey;
        if (!invoiceKey)
            throw new NFeParserError("Chave da NF-e ausente");
        // Ambos os campos simultâneos são ambíguos; nunca usar o documento do emitente.
        const recipientDocument = info.dest.CPF && info.dest.CNPJ
            ? (0, normalizeDocument_1.normalizeCustomerDocument)(null)
            : info.dest.CPF
                ? (0, normalizeDocument_1.normalizeCustomerDocument)(info.dest.CPF, "CPF")
                : (0, normalizeDocument_1.normalizeCustomerDocument)(info.dest.CNPJ, "CNPJ");
        return {
            invoiceKey,
            invoiceNumber: info.ide.nNF,
            customerName: optionalText(info.dest.xNome)?.replace(/\s+/g, " ") ?? null,
            phone: optionalText(info.dest.enderDest?.fone),
            ...recipientDocument,
        };
    }
}
exports.NFeParserService = NFeParserService;
//# sourceMappingURL=NFeParserService.js.map