# Cliente Magalu: pedido como fonte principal

`MagaluCustomerService` compõe fontes já implementadas, sem persistir dados.
`getCustomerWithInvoices` executa o mesmo fluxo e retorna `{ customer, invoices }`
com notas elegíveis já processadas para a coordenação de persistência.
`getCustomer` mantém o resultado de quatro campos. Seleções ambíguas não retornam
notas para gravação; pedidos completos retornam `invoices: []`.
Recebe um `MarketplaceOrder` normalizado pelo `MagaluOrderMapper`, que utiliza
`MagaluCustomerExtractor` para obter `order.customer`. Não recebe payload cru
da API nem busca novamente os dados do cliente no pedido.

```ts
import { MagaluCustomerService } from "./integrations";

const service = new MagaluCustomerService(userId);
const customer = await service.getCustomer({
  marketplaceAccountId,
  order,
  onFallbackError: error => {
    // Diagnóstico opcional: code, providerStatus e requestId. Não registrar payloads.
  },
});
// { name: string | null, phone: string | null,
//   document: string | null, documentType: "CPF" | "CNPJ" | null }
```

A entrada é validada e a conta deve estar ativa, ser Magalu e pertencer ao
usuário, inclusive quando não houver chamadas fiscais. A normalização e a
composição reutilizam `services/customers/customerData.ts`, extraído das regras
genéricas existentes do `CustomerExtractionService`. Telefone e documento usam
`normalizePhone` e `normalizeCustomerDocument`, que aplica `normalizeDocument`.
Documento e tipo são preservados juntos; o tipo ausente pode ser inferido pelo
helper compartilhado, sem consulta fiscal adicional.

## Prioridade e consultas

Se nome, telefone e documento válidos já existem no pedido, retorna diretamente:
não consulta entregas nem notas, não obtém XML e não chama o parser.
Se algum desses campos faltar, consulta pacotes por `MagaluDeliveryService` e
notas por `MagaluInvoiceService`, sequencialmente, em lotes. O serviço de notas
continua responsável por canal, paginação, status, conferência de chave e seleção
segura dentro de uma entrega; somente ele chama o parser NF-e compartilhado.

Cada campo válido do pedido prevalece sobre a NF-e. A fonte secundária apenas
completa ausências. Valores vazios ou estruturalmente inválidos são tratados como
ausentes. Não substitui um valor válido por `null`, não inventa dados, não mistura
campos de documentos conhecidos divergentes e não inclui XML ou tokens no retorno.

Quando o documento do pedido é conhecido, a consulta fiscal recebe esse documento
para conferir o destinatário. Pode continuar em outros pacotes após nota ausente
ou erro e interrompe a busca assim que todos os campos estiverem completos.
Complementos já conferidos são preservados mesmo que uma consulta posterior falhe.

Quando o documento do pedido falta, consulta todos os pacotes antes de combinar
os resultados. Notas de múltiplos pacotes precisam identificar o mesmo documento;
destinatários diferentes ou não identificados tornam a composição ambígua. Uma
coleção incompleta por erro também impede essa seleção. Nesses casos, mantém os
dados originais normalizados do pedido. Não acumula XMLs nem a coleção de notas.

## Falhas

NF-e ausente, inválida, falta de permissão, rate limit, timeout ou indisponibilidade
não eliminam os dados do pedido. O callback opcional recebe diagnóstico seguro;
erros inesperados são substituídos por uma mensagem interna sem conteúdo externo.
Mesmo uma falha no callback não elimina o resultado. Validação de entrada e
autorização da conta continuam obrigatórias e seus erros não são ocultados.

O serviço atende somente à extração do cliente. Caso outra regra futuramente
exija chave/número de NF-e, ela poderá consultar o serviço de notas separadamente.
Não há chamada fiscal obrigatória por esse motivo nesta etapa.

Os testes cobrem as 64 combinações de presença de nome/telefone/documento,
normalização CPF/CNPJ, prioridade, conflitos, falhas fiscais, múltiplos pacotes,
ausência de consultas desnecessárias e o fluxo com serviços reais e transporte
simulado. Não consultam a conta real nem persistem clientes/pedidos/notas.

Contratos oficiais utilizados pelos serviços existentes:
[Pedidos](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-order-list/index.html),
[Entregas](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-list/index.html),
[NF-es](https://developers.magalu.com/docs/apis/orders/ref/seller-v-1-get-deliveries-invoices/index.html).
Nenhum novo endpoint ou scope foi acrescentado.
