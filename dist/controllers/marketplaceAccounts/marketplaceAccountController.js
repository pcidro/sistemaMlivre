"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceAccountController = void 0;
const zod_1 = require("zod");
const disconnectMercadoLivreAccountService_1 = require("../../services/marketplaceAccounts/disconnectMercadoLivreAccountService");
const listMarketplaceAccountsService_1 = require("../../services/marketplaceAccounts/listMarketplaceAccountsService");
const paramsSchema = zod_1.z.object({
    marketplaceAccountId: zod_1.z.uuid(),
});
class MarketplaceAccountController {
    async list(req, res) {
        const accounts = await new listMarketplaceAccountsService_1.ListMarketplaceAccountsService().execute(req.user_id);
        return res.json({ data: accounts });
    }
    async disconnectMercadoLivre(req, res) {
        const { marketplaceAccountId } = paramsSchema.parse(req.params);
        await new disconnectMercadoLivreAccountService_1.DisconnectMercadoLivreAccountService().execute(marketplaceAccountId, req.user_id);
        return res.status(204).send();
    }
}
exports.MarketplaceAccountController = MarketplaceAccountController;
//# sourceMappingURL=marketplaceAccountController.js.map