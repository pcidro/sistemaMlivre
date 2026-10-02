"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerController = void 0;
const customerSchemas_1 = require("../../schemas/customerSchemas");
const CustomerQueryService_1 = require("../../services/customers/CustomerQueryService");
class CustomerController {
    service;
    constructor(service = new CustomerQueryService_1.CustomerQueryService()) {
        this.service = service;
    }
    async list(req, res) {
        const result = await this.service.list(req.user_id, req.query);
        res.set("Cache-Control", "private, no-store");
        return res.json(result);
    }
    async get(req, res) {
        const id = customerSchemas_1.customerIdSchema.parse(req.params.id);
        const customer = await this.service.get(req.user_id, id);
        res.set("Cache-Control", "private, no-store");
        return res.json(customer);
    }
}
exports.CustomerController = CustomerController;
//# sourceMappingURL=customerController.js.map