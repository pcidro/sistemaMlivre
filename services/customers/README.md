# Extração de cliente

`CustomerExtractionService.extract` combina os dados do pedido/envio e da NF-e. Retorna `{ name, phone, document, documentType }`, sem gravar no banco nem manter o XML no resultado.

1. Chama `getRecipient`, que fornece os dados disponíveis no pedido/envio.
2. Normaliza nome, telefone e CPF/CNPJ. Documentos numéricos têm 11 ou 14 dígitos; zeros iniciais são preservados e tipos incompatíveis são descartados. Não verifica dígitos verificadores.
3. Quando telefone e documento estão disponíveis, retorna sem consultar NF-e, mesmo se o nome estiver ausente.
4. Se faltar telefone ou documento, chama `getInvoiceXml`, inclusive quando o pedido já tem telefone. XML ausente preserva a primeira fonte.
5. Processa o XML com `NFeParserService` e completa somente campos ausentes. Nome, telefone e documento válidos da primeira fonte têm prioridade sobre a NF-e.

Se nenhuma fonte fornecer um telefone que possa ser normalizado, o resultado contém `phone: null`. Campos vazios não substituem informações válidas. Os dados recebidos não são alterados.

As fontes são funções fornecidas pelo chamador, permitindo reutilizar a regra com os serviços existentes sem colocar lógica específica do marketplace no serviço de extração. Se os dados do destinatário já foram obtidos, `getRecipient` pode simplesmente retornar esse objeto.

## Uso com os serviços existentes

```ts
import { MercadoLivreRecipientService } from "../../integrations/mercadolivre/mercadoLivreRecipientService";
import { MercadoLivreInvoiceService } from "../../integrations/mercadolivre/mercadoLivreInvoiceService";
import { CustomerExtractionService } from "./CustomerExtractionService";

const recipientService = new MercadoLivreRecipientService();
const invoiceService = new MercadoLivreInvoiceService();
const extractionService = new CustomerExtractionService();

const customer = await extractionService.extract({
  getRecipient: () => recipientService.getRecipient(marketplaceAccountId, order),
  getInvoiceXml: () => invoiceService.getInvoiceXml({
    marketplaceAccountId,
    userId,
    externalOrderId: order.externalOrderId,
  }),
});
// customer: { name: "Maria Silva", phone: "5511999999999", document: null, documentType: null }
```

`getInvoiceXml` é chamado apenas quando necessário. Falhas de API e XML inválido continuam como erros explícitos tratados por pedido pelo importador. Consulte [Documento do cliente](CustomerDocument.md) para contratos oficiais e limites de disponibilidade.

## Testes

`npm test` executa as combinações das fontes, prioridade de dados válidos, normalização, ausência de telefone, consulta condicional da NF-e, falhas explícitas e a composição dos serviços existentes com API simulada. Os XMLs utilizados são as fixtures fictícias do parser de NF-e.
