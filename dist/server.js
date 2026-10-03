"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const marketplaceAccountRoutes_1 = __importDefault(require("./routes/marketplaceAccountRoutes"));
const importRoutes_1 = __importDefault(require("./routes/importRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const cors_1 = __importDefault(require("cors"));
const errorHandler_1 = require("./middlewares/errorHandler");
const preventApiCaching_1 = require("./middlewares/preventApiCaching");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3333;
app.use("/api", preventApiCaching_1.preventApiCaching);
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
}));
app.use("/api", routes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/marketplace-accounts", marketplaceAccountRoutes_1.default);
app.use("/api/imports", importRoutes_1.default);
app.use("/api/customers", customerRoutes_1.default);
app.use("/api/dashboard", dashboardRoutes_1.default);
app.use((_req, res) => {
    res.status(404).json({ error: "Rota não encontrada" });
});
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`  Backend is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map