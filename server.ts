import "dotenv/config";
import express from "express";
import routes from "./routes";
import userRoutes from "./routes/userRoutes";
import marketplaceAccountRoutes from "./routes/marketplaceAccountRoutes";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const PORT = process.env.PORT || 3333;

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
  }),
);

app.use("/api", routes);
app.use("/api/users", userRoutes);
app.use("/api/marketplace-accounts", marketplaceAccountRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`  Backend is running on http://localhost:${PORT}`);
});
