import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

app.use("/api/auth", authRouter);
app.use(errorHandler);

export default app;
