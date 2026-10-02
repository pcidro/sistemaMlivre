import type { Request, Response } from "express";

import { magaluCallbackQuerySchema } from "../../schemas/magaluCallbackSchemas";

export function sendMagaluCallbackResponse(res: Response, status: number, message: string) {
  // Somente mensagens internas constantes; nunca refletir code, state ou erros externos.
  if (res.req.accepts(["html", "json"]) === "json") {
    return res.status(status).json({ status: "not_connected", message });
  }
  return res.status(status).type("html").send(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conexão Magalu | LJ Fontes</title></head><body><main><h1>Conexão Magalu</h1><p>${message}</p><p>Nenhuma conta foi conectada. Você pode fechar esta página.</p></main></body></html>`,
  );
}

export class MagaluCallbackController {
  handle(req: Request, res: Response) {
    if (req.originalUrl.length > 8192) {
      return sendMagaluCallbackResponse(res, 414, "A URL recebida excede o tamanho permitido.");
    }
    if (Object.keys(req.query).length === 0) {
      return sendMagaluCallbackResponse(res, 200,
        "O endereço de retorno está disponível. A autorização da integração ainda está em preparação.");
    }
    if (!magaluCallbackQuerySchema.safeParse(req.query).success) {
      return sendMagaluCallbackResponse(res, 400, "Os parâmetros de retorno são inválidos ou incompletos.");
    }

    // A validação acima é apenas estrutural. Sem início OAuth e state vinculado
    // à sessão, nenhum retorno pode ser considerado uma autorização válida.
    return sendMagaluCallbackResponse(res, 501,
      "A autorização da integração ainda não foi habilitada. Inicie uma nova conexão quando ela estiver disponível.");
  }
}
