# Persistência de um pedido Magalu

`MagaluOrderImportService` coordena a extração do cliente e encaminha o resultado
ao `ImportedOrderPersistenceService` existente. Não implementa outra persistência,
queries de escrita próprias, rota, frontend ou execução completa de um `Import`.

```ts
import { MagaluOrderImportService } from "./MagaluOrderImportService";

const service = new MagaluOrderImportService(userId); // usuário autenticado
const result = await service.execute({
  marketplaceAccountId,
  order, // MarketplaceOrder de MagaluOrderMapper ou MagaluOrderService
  onFallbackError: error => {
    // Diagnóstico seguro opcional, sem payload, XML ou credenciais.
  },
});
// { orderId, customerId, invoiceId, invoiceIds,
//   created, itemsCount, customerHasPhone }
```

O método atende um pedido por chamada. O futuro coordenador pode consumir os
lotes de `MagaluOrderService`, tratando resultados e erros por pedido.

## Dados e identidade

- A conta deve estar ativa, pertencer ao usuário e ter `platform = MAGALU`.
  A autorização é conferida na extração e novamente dentro da transação.
- `Order.externalOrderId` recebe `order.code`, já escolhido pelo mapper, com
  zeros iniciais preservados. Não usa o UUID do payload como identidade alternativa.
  A chave `marketplaceAccountId + externalOrderId` separa pedidos de duas contas,
  mesmo com o mesmo código.
- `Customer` recebe nome, telefone, telefone normalizado, CPF/CNPJ e tipo.
  Reutilização e atualização seguem as regras compartilhadas, nunca apenas o nome.
- `OrderItem` recebe a lista completa de produtos. A sincronização existente
  conserva linhas inalteradas e substitui a lista quando necessário, sem cópias.
- `Invoice` recebe chave, número, nome do destinatário e telefone das notas
  selecionadas. `processedAt` continua gerado pelo banco. Documento e tipo
  pertencem a `Customer`; `issuedAt` e status da API não têm campos fiscais no
  modelo atual e não motivaram alterações de schema.

## Reutilização do fallback

`MagaluCustomerService.getCustomerWithInvoices` executa o mesmo fluxo de
`getCustomer`, retornando também as notas elegíveis já processadas. O método
original mantém seu contrato de quatro campos. Pedido completo retorna coleção
fiscal vazia, sem buscar entregas, XML ou parser adicional.

Notas selecionadas de vários pacotes consultados no fallback são encaminhadas à
persistência, sem outra consulta ou parsing. Não envia XML, tokens ou payload
fiscal bruto. Seleções ambíguas ou notas de destinatários conflitantes não são
gravadas. Falhas fiscais preservam o pedido e os complementos já confirmados,
conforme a política de composição do cliente.

## Transação e reimportação

O serviço genérico aceita `invoices: ParsedNFeData[]` como alternativa ao
`invoice` singular. Cliente, pedido, produtos e notas ficam na mesma transação
Prisma `Serializable`, com os retries limitados existentes. Consultas externas
acontecem antes dela. O contrato singular do Mercado Livre permanece compatível.

`invoiceId` representa a primeira nota recebida ou `null`; `invoiceIds` contém
IDs únicos das notas recebidas, presente quando a entrada usa `invoices`.
Chaves repetidas entre pacotes reutilizam a mesma nota. Reimportar conserva IDs,
não duplica dados e não apaga informações conhecidas com ausências. Uma coleção
fiscal vazia não exclui notas anteriormente salvas.

Uma chave já ligada a outro pedido continua sendo conflito 409, com rollback de
todas as novas gravações. O modelo associa uma NF-e a apenas um pedido, e o
vínculo anterior não é movido silenciosamente.

O schema já suporta Magalu e os relacionamentos necessários. Nenhuma migration
foi criada. O banco deve ter as migrations anteriores aplicadas antes de usar
o serviço em produção.

## Validação

Testes com `MemoryPersistenceDatabase` cobrem primeira importação, reimportação,
CPF/CNPJ, telefone/NF-e ausentes, códigos iguais em contas diferentes,
atualizações, deduplicação conservadora, múltiplas notas, autorização na transação
e rollback. Utilizam mapper e parser reais, fixtures fictícias e consultas
simuladas. Não acessam Neon nem simulam locks reais do PostgreSQL.

Transações seguem a versão Prisma 7 utilizada pelo projeto:
[documentação oficial](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions).
