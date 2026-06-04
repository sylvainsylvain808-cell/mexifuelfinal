import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mealDataRouter from "./meal-data";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mealDataRouter);

export default router;
