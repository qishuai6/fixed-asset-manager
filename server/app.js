import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./db.js";
import { createRepository } from "./repository.js";
import { createImportManager } from "./importer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function apiResponse(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      res.json({ ok: true, data: result });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message || "请求失败" });
    }
  };
}

export function createApp(options = {}) {
  const app = express();
  const dataDir = ensureDir(options.dataDir || path.resolve(__dirname, "..", "data"));
  const db = createDatabase(options.dbPath || path.join(dataDir, "fixed-assets.sqlite"));
  const repository = createRepository(db);
  const imports = createImportManager(repository);
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(cors());
  app.use(express.json({ limit: "4mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, data: { status: "ok" } });
  });

  app.get("/api/dashboard", apiResponse(() => repository.getDashboard()));

  app.get("/api/assets", apiResponse((req) =>
    repository.listAssets({
      search: req.query.search,
      status: req.query.status,
      category: req.query.category,
      includeDeactivated: req.query.includeDeactivated === "true"
    })
  ));

  app.post("/api/assets", apiResponse((req) => repository.createAsset(req.body)));
  app.put("/api/assets/:id", apiResponse((req) => repository.updateAsset(Number(req.params.id), req.body)));
  app.post("/api/assets/:id/assign", apiResponse((req) => repository.assignAsset(Number(req.params.id), req.body)));
  app.post("/api/assets/:id/return", apiResponse((req) => repository.returnAsset(Number(req.params.id), req.body)));
  app.post("/api/assets/:id/retire", apiResponse((req) => repository.retireAsset(Number(req.params.id), req.body)));
  app.post("/api/assets/:id/deactivate", apiResponse((req) => repository.deactivateAsset(Number(req.params.id), req.body)));

  app.get("/api/asset-categories", apiResponse(() => repository.listCategories()));
  app.post("/api/asset-categories", apiResponse((req) => repository.createCategory(req.body)));
  app.put("/api/asset-categories/:id", apiResponse((req) => repository.updateCategory(Number(req.params.id), req.body)));

  app.get("/api/employees", apiResponse((req) => repository.listEmployees({
    includeInactive: req.query.includeInactive !== "false"
  })));
  app.get("/api/employees/:id/assets", apiResponse((req) => repository.listEmployeeAssets(Number(req.params.id))));

  app.post("/api/import/assets/preview", upload.single("file"), apiResponse(async (req) => {
    if (!req.file) throw new Error("请上传文件");
    return imports.previewImport("assets", req.file);
  }));
  app.post("/api/import/assets", apiResponse((req) => imports.commitImport("assets", req.body.importToken)));

  app.post("/api/import/employees/preview", upload.single("file"), apiResponse(async (req) => {
    if (!req.file) throw new Error("请上传文件");
    return imports.previewImport("employees", req.file);
  }));
  app.post("/api/import/employees", apiResponse((req) => imports.commitImport("employees", req.body.importToken)));

  const distDir = path.resolve(__dirname, "..", "dist");
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  return { app, db, repository };
}
