import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import documentsRouter from "./documents";
import expensesRouter from "./expenses";
import materialsRouter from "./materials";
import notificationsRouter from "./notifications";
import paymentsRouter from "./payments";
import projectsRouter from "./projects";
import settingsRouter from "./settings";
import tendersRouter from "./tenders";
import workersRouter from "./workers";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use(authenticateToken);

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/tenders", tendersRouter);
apiRouter.use("/expenses", expensesRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/workers", workersRouter);
apiRouter.use("/materials", materialsRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/notifications", notificationsRouter);

export default apiRouter;

