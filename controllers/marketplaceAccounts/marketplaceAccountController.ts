import { Request, Response } from "express";
import { z } from "zod";

import { DisconnectMercadoLivreAccountService } from "../../services/marketplaceAccounts/disconnectMercadoLivreAccountService";
import { ListMarketplaceAccountsService } from "../../services/marketplaceAccounts/listMarketplaceAccountsService";

const paramsSchema = z.object({
  marketplaceAccountId: z.uuid(),
});

export class MarketplaceAccountController {
  async list(req: Request, res: Response) {
    const accounts = await new ListMarketplaceAccountsService().execute(
      req.user_id,
    );

    return res.json({ data: accounts });
  }

  async disconnectMercadoLivre(req: Request, res: Response) {
    const { marketplaceAccountId } = paramsSchema.parse(req.params);

    await new DisconnectMercadoLivreAccountService().execute(
      marketplaceAccountId,
      req.user_id,
    );

    return res.status(204).send();
  }
}
