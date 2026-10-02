# CPF/CNPJ do cliente

Documentação oficial consultada em 01/10/2026:

- [Dados para emissão de Nota Fiscal](https://developers.mercadolivre.com.br/pt_br/categorizacao-de-produtos/faturamento), atualização de 16/06/2026: `GET /orders/{order_id}` fornece `buyer.billing_info.id`. Com esse ID, `GET /orders/billing-info/MLB/{billing_info_id}` fornece `buyer.billing_info.identification.type` e `.number`. Somente CPF/CNPJ são aceitos.
- [Billing info — migração e disponibilidade](https://developers.mercadolivre.com.br/en_us/category-prediction-resource/billing-info): o recurso antigo `/orders/{order_id}/billing_info` foi descontinuado. Campos de identificação podem não estar disponíveis.
- [Informação fiscal do envio](https://developers.mercadolivre.com.br/pt_br/produto-autenticacao-autorizacao/importar-nota-fiscal), atualização de 03/08/2026: como alternativa, `GET /shipments/{shipment_id}/billing_info` fornece `receiver.document.id` e `.value`. Senders, carrier e additional_documents são ignorados.
- [Leiaute oficial da NF-e, grupo E](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J+I+v4eN00E%3D): `NFe/infNFe/dest/CPF` ou `CNPJ`, também sob `nfeProc`, é a alternativa final.

`MercadoLivreRecipientService` consulta o faturamento do pedido quando há ID e, sem documento válido, o faturamento do envio disponível. Mantém as prioridades existentes de nome/telefone. Recursos fiscais opcionais com 204/404/403 deixam documento ausente para permitir fallback; rede, 429 persistente e 5xx continuam falhas explícitas por pedido. As chamadas usam o limitador compartilhado do importador.

A busca de pedidos não é considerada fonte de documento. Não são usados `buyer.cpf` ou `buyer.cnpj`. Metadados de `invoice_data` não contêm XML nem documento do destinatário nessa resposta documentada. O download continua pelo `MercadoLivreInvoiceService` existente e depende da disponibilização oficial do XML.

`normalizeDocument` aceita dígitos, espaços e pontuação de CPF/CNPJ; remove formatação, preserva zeros e recusa tamanho diferente de 11/14, letras e mascaramento. O tipo é inferido e divergência com tipo declarado é recusada. A validação é estrutural, sem checksum. Esta tarefa atende documentos numéricos; CNPJ alfanumérico não é convertido removendo letras, pois isso inventaria outro documento.

`Customer.document` e `documentType` são opcionais. Migration: `20261001180000_add_customer_document`. Não há unicidade por documento. O índice B-tree auxilia buscas exatas; buscas arbitrárias por trecho podem precisar de outros índices conforme volume. Nenhuma migration é aplicada ao banco configurado durante os testes.

Dados válidos enriquecem o cliente; null/inválido não apagam documento existente. Reutilização continua exigindo telefone, nome compatível e um único candidato do mesmo usuário, agora sem documentos conflitantes. Não há união somente por CPF/CNPJ. Correção de identidade em cliente compartilhado preserva as demais vendas. XML não é armazenado e documento não é duplicado em Invoice.

Extração consulta NF-e quando faltar telefone **ou documento**, preservando informações válidas do Mercado Livre. Lista e detalhes de clientes incluem documento/tipo com autorização e no-store existentes. `search` pesquisa números com ou sem pontuação. OAuth, contas, dashboard e resumo de importação não expõem o novo dado.

O frontend não tinha lista de clientes: foi adicionada uma tela simples acessível por “Consultar clientes”, com busca, paginação e coluna CPF/CNPJ. `formatDocument` formata apenas na apresentação e retorna “Não informado” quando ausente/inválido.

Testes usam somente dados fictícios e respostas simuladas. A migration é validada sobre PostgreSQL em memória (PGlite), incluindo dados anteriores e ausência de unicidade. Não há prova de disponibilidade em contas reais nem atualização retroativa automática: novas importações enriquecem registros quando as fontes oficiais fornecerem o documento.

## Arquivos criados ou alterados nesta tarefa

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261001180000_add_customer_document/migration.sql`
- `backend/prisma/customerDocumentMigration.test.ts`
- `backend/utils/normalizeDocument.ts`
- `backend/utils/normalizeDocument.test.ts`
- `backend/integrations/types/marketplace.types.ts`
- `backend/integrations/mercadolivre/mercadoLivreRecipientService.ts`
- `backend/integrations/mercadolivre/mercadoLivreRecipientService.test.ts`
- `backend/services/invoices/NFeParserService.ts`
- `backend/services/invoices/NFeParserService.test.ts`
- `backend/services/invoices/README.md`
- `backend/services/customers/CustomerExtractionService.ts`
- `backend/services/customers/CustomerExtractionService.test.ts`
- `backend/services/customers/CustomerQueryService.ts`
- `backend/services/customers/CustomerQueryService.test.ts`
- `backend/services/customers/testing/MemoryCustomerQueryDatabase.ts`
- `backend/services/customers/README.md`
- `backend/services/customers/CustomerQueryService.md`
- `backend/services/customers/CustomerDocument.md`
- `backend/services/imports/ImportedOrderPersistenceService.ts`
- `backend/services/imports/ImportedOrderPersistenceService.test.ts`
- `backend/services/imports/MercadoLivreImportService.test.ts`
- `backend/services/imports/testing/MemoryPersistenceDatabase.ts`
- `backend/services/imports/README.md`
- `backend/services/imports/MercadoLivreImportService.md`
- `backend/routes/customerRoutes.test.ts`
- `backend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/components/CustomersList.tsx`
- `frontend/src/utils/formatDocument.ts`
- `frontend/tests/formatDocument.test.ts`
- `frontend/package.json`
- `frontend/README.md`

O build também atualiza os artefatos gerados em `backend/dist`. Alterações de etapas anteriores já presentes no diretório foram preservadas. `MercadoLivreOrderService`, `MercadoLivreInvoiceService`, OAuth, autenticação e o coordenador de importação foram analisados e não precisaram de mudanças de implementação.
