import { Router, type IRouter } from "express";
import fs from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "meal-data.json");

const router: IRouter = Router();

router.get("/meal-data", async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    res.json(JSON.parse(raw));
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      res.json([]);
    } else {
      req.log.error({ err }, "Failed to read meal data");
      res.status(500).json({ error: "Failed to read meal data" });
    }
  }
});

router.post("/meal-data", async (req, res) => {
  try {
    const data: unknown = req.body;
    if (!Array.isArray(data)) {
      res.status(400).json({ error: "Expected an array of meal entries" });
      return;
    }
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    res.json({ ok: true, count: data.length });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to write meal data");
    res.status(500).json({ error: "Failed to write meal data" });
  }
});

export default router;
