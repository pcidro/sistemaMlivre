import type { Request, Response } from "express";
import { DashboardService } from "../../services/dashboard/DashboardService";
export declare class DashboardController {
    private readonly service;
    constructor(service?: Pick<DashboardService, "execute">);
    handle(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=dashboardController.d.ts.map