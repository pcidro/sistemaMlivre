# Consulta e extração de NF-e

Documentação oficial consultada em **01/10/2026**:

- [Gestão e Consulta de Notas Fiscais](https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/obtendo-nota-fiscal), atualizada em 18/08/2026.
- [Importar Nota Fiscal](https://developers.mercadolivre.com.br/pt_br/produto-autenticacao-autorizacao/importar-nota-fiscal), atualizada em 03/08/2026.
- [Upload invoices](https://developers.mercadolivre.com.br/en_us/upload-invoices): o recurso de documentos por pacote exclui o Brasil; não é usado aqui.

## MercadoLivreInvoiceService

`getInvoiceXml({ marketplaceAccountId, userId, externalOrderId })` verifica se a conta está ativa e pertence ao usuário. O seller ID vem da conta salva; o token permanece no backend e é renovado pelo serviço OAuth existente.

1. Consulta `GET /users/{seller_id}/invoices/orders/{order_id}`.
2. Seleciona uma nota autorizada de venda, quando disponível.
3. Obtém `attributes.xml_location` (ou `xml_location` diretamente, se presente).
4. Resolve o caminho relativo contra `https://api.mercadolibre.com` e faz `GET` com o bearer token.
5. Retorna o conteúdo XML como `string`, sem gravar arquivo, XML no banco ou logs do documento.

O serviço aceita também uma lista de notas e retorna a primeira NF-e de venda autorizada cujo XML está disponível. Ele não consulta notas de retorno, remessa, CT-e ou DC-e.

`null` indica consulta/documento ausente (`404` ou `204`), nota não autorizada ou ausência de localização de XML. Autorização negada, payload inválido e falhas persistentes produzem `AppError`; não são confundidos com nota ausente. Há timeout por requisição, até três tentativas para rede/429/5xx e uma renovação após 401 por recurso. Os downloads recusam redirecionamentos e URLs fora do endpoint oficial de XML da própria conta.

**Limite da API documentada:** a consulta individual com download está descrita para operações que usam o emissor do Mercado Livre. `GET /shipments/{shipment_id}/invoice_data?siteId=MLB` consulta os metadados da nota enviada externamente, mas sua resposta documentada não contém XML nem URL para baixá-lo. Não se usa esse JSON como substituto de XML nem se inventa um endpoint de download. Notas externas só poderão ser processadas aqui quando disponibilizadas pelo recurso de invoices com `xml_location`. A disponibilidade real depende da conta, das permissões e da operação logística.

## NFeParserService

`parse(xml)` usa `fast-xml-parser`, sem depender de marketplace, OAuth ou banco. Aceita NF-e modelo 55 nas formas `nfeProc/NFe/infNFe` e `NFe/infNFe`, com namespace padrão ou prefixado.

Retorna somente:

- `invoiceKey`: os 44 dígitos do atributo `infNFe/@Id`, removendo `NFe`; usa `protNFe/infProt/chNFe` como alternativa quando o atributo não existe e recusa divergências.
- `invoiceNumber`: `infNFe/ide/nNF`, preservado como texto.
- `customerName`: `infNFe/dest/xNome`, ou `null` se ausente/vazio.
- `phone`: `infNFe/dest/enderDest/fone`, ou `null` se ausente/vazio.
- `document` / `documentType`: CPF ou CNPJ numérico de `infNFe/dest`, normalizado, ou ambos `null` quando ausente/inválido/ambíguo. Não usa documento do emitente. Namespaces padrão e prefixados são aceitos.

O telefone é o texto original do XML, com espaços externos removidos. `CustomerExtractionService` normaliza o telefone. Documento tem validação estrutural, sem dígitos verificadores. XML e demais dados não fazem parte do resultado.

A validação é sintática e da estrutura necessária à extração. Não valida o XSD completo, assinatura digital, dígito verificador da chave ou autorização na SEFAZ. DTD/entidades customizadas, lotes de documentos, modelos diferentes de 55 e XML acima de 5 MiB são rejeitados. Erros são `NFeParserError` (422), sem o conteúdo do XML.

## Uso interno

```ts
import { MercadoLivreInvoiceService } from "../../integrations/mercadolivre";
import { NFeParserService } from "./NFeParserService";

const xml = await new MercadoLivreInvoiceService().getInvoiceXml({
  marketplaceAccountId,
  userId,
  externalOrderId,
});
const invoice = xml === null ? null : new NFeParserService().parse(xml);
// Persistir somente os campos de invoice; não incluir xml na gravação.
```

O futuro importador deve tratar erros por pedido e seguir para os próximos. A ausência de telefone já retorna normalmente `phone: null` e não requer tratamento de erro. Esta etapa implementa os serviços de NF-e, sem rotas públicas, alterações no banco ou um novo fluxo de importação.

## Testes

Executar `npm test` e `npm run build` no backend. As fixtures são fictícias, reduzidas, em ambiente de homologação e sem validade fiscal. Os testes de integração usam respostas simuladas e não acessam contas reais.
