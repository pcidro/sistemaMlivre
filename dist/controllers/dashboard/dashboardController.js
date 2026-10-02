"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const DashboardService_1 = require("../../services/dashboard/DashboardService");
class DashboardController {
    service;
    constructor(service = new DashboardService_1.DashboardService()) {
        this.service = service;
    }
    async handle(req, res) {
        const summary = await this.service.execute(req.user_id);
        res.set("Cache-Control", "private, no-store");
        return res.json(summary);
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboardController.js.map