"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoLivreImportController = void 0;
const importSchemas_1 = require("../../schemas/importSchemas");
const MercadoLivreImportService_1 = require("../../services/imports/MercadoLivreImportService");
class MercadoLivreImportController {
    service;
    constructor(service = new MercadoLivreImportService_1.MercadoLivreImportService()) {
        this.service = service;
    }
    async handle(req, res) {
        const body = importSchemas_1.mercadoLivreImportBodySchema.parse(req.body);
        const summary = await this.service.execute({ ...body, userId: req.user_id });
        return res.json(summary);
    }
}
exports.MercadoLivreImportController = MercadoLivreImportController;
//# sourceMappingURL=mercadoLivreImportController.js.map