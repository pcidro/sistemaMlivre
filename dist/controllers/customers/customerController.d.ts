import type { Request, Response } from "express";
import { CustomerQueryService } from "../../services/customers/CustomerQueryService";
export declare class CustomerController {
    private readonly service;
    constructor(service?: Pick<CustomerQueryService, "list" | "get">);
    list(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    get(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=customerController.d.ts.map