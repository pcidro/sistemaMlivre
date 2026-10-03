# Persistência de pedidos importados

`ImportedOrderPersistenceService.execute` recebe dados normalizados, sem consultar marketplaces, extrair dados do cliente ou processar XML. A coordenação e as rotas estão documentadas em [MercadoLivreImportService.md](MercadoLivreImportService.md) e [MagaluImportService.md](MagaluImportService.md). Ambas reutilizam `ImportRunner` para lotes, concorrência, contadores e status, mantendo os adapters específicos de cada plataforma.

## Contrato

```ts
import { ImportedOrderPersistenceService } from "./ImportedOrderPersistenceService";

const result = await new ImportedOrderPersistenceService().execute({
  userId,
  marketplaceAccountId,
  order: { ...normalizedOrder, customer: extractedCustomer },
  invoice: parsedInvoice ?? null,
});
// { orderId, customerId, invoiceId, created, itemsCount, customerHasPhone }
```

`order` usa o tipo existente `MarketplaceOrder`; `invoice` usa `ParsedNFeData` do parser compartilhado e pode ser omitida ou `null`. O resultado contém IDs e contagens. `invoiceId` refere-se à nota recebida nesta chamada; é `null` se nenhuma nota foi recebida, mesmo que o pedido já possua notas salvas.

Também aceita `invoices: ParsedNFeData[]`, em alternativa a `invoice` não nula.
Todas as notas ficam na mesma transação; o resultado acrescenta `invoiceIds`
com IDs únicos e mantém `invoiceId` como a primeira nota ou `null`. Uma coleção
vazia não apaga notas anteriores. O formato singular usado pelo Mercado Livre
e seu resultado permanecem compatíveis.

A Magalu utiliza este serviço por
[MagaluOrderImportService](MagaluOrderImportService.md), sem duplicar queries
ou deduplicação. O schema já suporta MAGALU e não exige nova migration.

Nomes, telefones e CPF/CNPJ são normalizados novamente na entrada. Documento ausente/inválido não apaga o existente. Datas devem ser objetos `Date` válidos; preços devem ser strings decimais não negativas com até duas casas, compatíveis com `DECIMAL(12,2)`, ou `null`. A entrada é validada com Zod. Campos extras, inclusive XML, são recusados sem imprimir o payload.

## Transação e duplicidade

- Verifica dentro da transação que a conta pertence ao usuário, está ativa e corresponde à plataforma do pedido.
- Localiza o pedido por `marketplaceAccountId + externalOrderId`, usando a chave única composta existente no banco.
- Cria ou atualiza `Customer`, `Order`, `Invoice` e `OrderItem` na mesma transação Prisma com isolamento `Serializable`. Falhas fazem rollback de todas as alterações daquele pedido.
- Mantém os IDs do pedido e da nota na reimportação. Atualiza somente os campos alterados. Dados opcionais ausentes não apagam valores conhecidos; ausência da NF-e não exclui notas já salvas.
- Localiza a NF-e pela chave única `invoiceKey`. Uma nova chave representa outra nota. Uma chave já relacionada a outro pedido resulta em erro 409; o vínculo anterior nunca é movido silenciosamente.
- Reexecuta toda a transação até quatro vezes em conflitos `P2034` ou `P2002`, com espera curta entre tentativas. Erros finais não expõem mensagens do Prisma ou dados pessoais.

Essa estratégia segue a [documentação de transações do Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions), versão utilizada pelo projeto.

**Limite do modelo atual de NF-e:** `Invoice` pertence a um único `Order`. Uma nota que cobre vários pedidos de um carrinho não pode ser ligada a todos neste modelo. O serviço sinaliza o conflito sem duplicar ou transferir a nota. A representação de notas compartilhadas precisa de uma evolução explícita do relacionamento antes de aceitar esse cenário.

## Reutilização de clientes

Para um novo pedido, só reutiliza um cliente se:

1. o telefone normalizado estiver disponível e for igual;
2. os dois nomes estiverem disponíveis e forem iguais após normalizar espaços e caixa;
3. houver exatamente um candidato compatível;
4. o candidato estiver vinculado a pedidos de contas do mesmo usuário.
5. não houver conflito entre documentos válidos conhecidos.

Nunca une clientes apenas pelo nome, por telefone com nomes conflitantes, por nome desconhecido ou quando houver candidatos ambíguos. Telefones não têm índice único, pois podem ser compartilhados por pessoas diferentes. Contas distintas do mesmo usuário podem reutilizar um cliente compatível; usuários distintos não compartilham registros pela regra de deduplicação.

Na reimportação, o vínculo já conhecido do pedido permite manter seu cliente mesmo sem telefone. Novas informações enriquecem esse registro. Uma correção de identidade em um cliente compartilhado cria/reutiliza outro cliente para o pedido corrigido, sem alterar os dados das outras vendas. Clientes antigos que ficam sem pedidos após uma troca de vínculo não são excluídos automaticamente nesta etapa.

## Produtos

`order.items` deve ser a **lista completa atual** daquele pedido. Não envie uma página ou lista parcial.

O serviço compara os itens como um conjunto com multiplicidade, incluindo produto, nome, quantidade e preço exato. Reordenação ou representação decimal equivalente não recria linhas. Quando a lista muda, substitui os itens daquele pedido dentro da mesma transação. Uma lista vazia remove seus itens antigos. Não afeta os produtos de outros pedidos.

## Migração

A migração `20261001160000_allow_missing_imported_customer_name_and_price` apenas permite `null` em `Customer.name` e `OrderItem.unitPrice`. Esses campos já podem faltar nos serviços de normalização. Não são inventados nomes de clientes nem preços zero.

Aplicar com `npm exec prisma migrate deploy` no ambiente de banco escolhido, antes de utilizar o serviço. A migração foi preparada nesta tarefa, mas **não foi aplicada ao Neon**.

## Validação

`npm test` executa cenários de primeira importação, repetição, alterações, telefone/NF-e ausentes, múltiplos produtos, reutilização conservadora de clientes, isolamento por conta/usuário, rollback e repetição de conflitos. `npm run build` verifica os tipos contra o Prisma Client gerado do schema.

Os testes automáticos usam um banco em memória que implementa os delegates utilizados pelo serviço e só confirma alterações quando a transação conclui. Ele verifica estado, chaves únicas simuladas e rollback; **não substitui uma validação de locks e concorrência no PostgreSQL**. Não acessa o banco configurado em `DATABASE_URL`.

Para validar em um PostgreSQL de teste separado, após aplicar as migrações:

| Cenário | Resultado esperado |
| --- | --- |
| Importar um pedido com dois produtos e NF-e | Um cliente, um pedido, uma nota, dois itens, todos com os vínculos corretos. |
| Reimportar o mesmo payload | Mesmos IDs e mesmas contagens. |
| Alterar status, data e produtos | Mesmo pedido, informações atualizadas e apenas a lista atual de itens. |
| Importar sem telefone ou sem NF-e | Pedido salvo normalmente; telefone `null` ou nenhuma nota nova. |
| Reimportar com informações opcionais ausentes | Valores conhecidos preservados. |
| Executar simultaneamente o mesmo pedido | Um pedido e uma nota após a resolução dos conflitos. |
| Importar pedidos distintos com nome/telefone compatíveis simultaneamente | Um cliente reutilizado após eventuais retries de serialização. |
| Causar falha na gravação dos produtos | Nenhuma gravação parcial; estado anterior preservado. |
