import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8899);
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, "..", "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "fixed-assets.sqlite");

const { app } = createApp({ dataDir, dbPath });

app.listen(port, () => {
  console.log(`fixed-asset-manager server running at http://127.0.0.1:${port}`);
});
