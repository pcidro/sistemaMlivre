import { Buffer } from "node:buffer";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";

import { AppError } from "../../errors/AppError";
import { normalizeCustomerDocument } from "../../utils/normalizeDocument";
import type { NormalizedDocument } from "../../utils/normalizeDocument";

export const MAX_NFE_XML_BYTES = 5 * 1024 * 1024;

export interface ParsedNFeData extends NormalizedDocument {
  invoiceKey: string;
  invoiceNumber: string;
  customerName: string | null;
  phone: string | null;
}

export class NFeParserError extends AppError {
  constructor(message = "XML da NF-e inválido") {
    super(message, 422);
    Object.setPrototypeOf(this, NFeParserError.prototype);
    this.name = "NFeParserError";
  }
}

const invoiceKeySchema = z.string().regex(/^\d{44}$/);
const optionalTextSchema = z.string().optional();
const nfeSchema = z.object({
  infNFe: z.object({
    "@_Id": z.string().optional(),
    ide: z.object({
      mod: z.literal("55"),
      nNF: z.string().regex(/^\d{1,9}$/),
    }),
    dest: z.object({
      xNome: optionalTextSchema,
      CPF: optionalTextSchema,
      CNPJ: optionalTextSchema,
      enderDest: z.object({ fone: optionalTextSchema }).optional(),
    }),
  }),
});

const processedNfeSchema = z.object({
  NFe: nfeSchema,
  protNFe: z
    .object({ infProt: z.object({ chNFe: invoiceKeySchema }) })
    .optional(),
});

const documentSchema = z.union([
  z.object({ nfeProc: processedNfeSchema }).strict(),
  z.object({ NFe: nfeSchema }).strict(),
]);

function optionalText(value: string | undefined): string | null {
  return value?.trim() || null;
}

/** Extrai dados de uma NF-e modelo 55; não verifica assinatura nem autorização SEFAZ. */
export class NFeParserService {
  parse(xml: string): ParsedNFeData {
    if (!xml.trim()) throw new NFeParserError();

    if (Buffer.byteLength(xml, "utf8") > MAX_NFE_XML_BYTES) {
      throw new NFeParserError("XML da NF-e excede o limite de tamanho");
    }

    // NF-e não precisa de DTD. Recusá-lo impede expansão de entidades arbitrárias.
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
      throw new NFeParserError("Declarações DTD não são permitidas na NF-e");
    }

    let document: z.infer<typeof documentSchema>;

    try {
      if (XMLValidator.validate(xml) !== true) throw new Error();

      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: true,
        ignoreDeclaration: true,
        ignorePiTags: true,
        maxNestedTags: 100,
      });
      const parsed: unknown = parser.parse(xml);
      document = documentSchema.parse(parsed);
    } catch {
      // Nunca repassar mensagens da biblioteca: elas podem conter o XML recebido.
      throw new NFeParserError();
    }

    const processed = "nfeProc" in document ? document.nfeProc : null;
    const nfe = "NFe" in document ? document.NFe : document.nfeProc.NFe;
    const info = nfe.infNFe;
    const id = info["@_Id"];
    const idKey = id === undefined ? null : /^NFe(\d{44})$/.exec(id)?.[1];
    const protocolKey = processed?.protNFe?.infProt.chNFe ?? null;

    if (id !== undefined && !idKey) throw new NFeParserError();
    if (idKey && protocolKey && idKey !== protocolKey) {
      throw new NFeParserError("Chaves da NF-e e do protocolo são diferentes");
    }

    const invoiceKey = idKey ?? protocolKey;
    if (!invoiceKey) throw new NFeParserError("Chave da NF-e ausente");

    // Ambos os campos simultâneos são ambíguos; nunca usar o documento do emitente.
    const recipientDocument = info.dest.CPF && info.dest.CNPJ
      ? normalizeCustomerDocument(null)
      : info.dest.CPF
        ? normalizeCustomerDocument(info.dest.CPF, "CPF")
        : normalizeCustomerDocument(info.dest.CNPJ, "CNPJ");

    return {
      invoiceKey,
      invoiceNumber: info.ide.nNF,
      customerName: optionalText(info.dest.xNome)?.replace(/\s+/g, " ") ?? null,
      phone: optionalText(info.dest.enderDest?.fone),
      ...recipientDocument,
    };
  }
}
