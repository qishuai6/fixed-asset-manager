const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const net = require("node:net");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let serverInstance = null;
let databaseInstance = null;
let appPort = null;

function getAppRoot() {
  return app.getAppPath();
}

function getPreloadPath() {
  return path.join(getAppRoot(), "electron", "preload.cjs");
}

function getDataDir() {
  return path.join(app.getPath("userData"), "data");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, retries = 40) {
  for (let index = 0; index < retries; index += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch (error) {
      // Ignore until next retry.
    }
    await wait(500);
  }
  throw new Error("Desktop app server did not become ready in time.");
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 1160,
    minHeight: 760,
    backgroundColor: "#eef3fb",
    title: "Fixed Asset Manager",
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(startUrl);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startEmbeddedServer() {
  appPort = await getFreePort();

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "fixed-assets.sqlite");
  const serverModuleUrl = pathToFileURL(path.join(getAppRoot(), "server", "app.js")).href;
  const { createApp } = await import(serverModuleUrl);
  const { app: expressApp, db } = createApp({ dataDir, dbPath });
  databaseInstance = db;

  const startUrl = `http://127.0.0.1:${appPort}`;
  serverInstance = expressApp.listen(appPort, "127.0.0.1");
  serverInstance.on("error", (error) => {
    if (!app.isQuitting) {
      dialog.showErrorBox("Fixed Asset Manager", error.message || "Internal local server failed.");
      app.quit();
    }
  });
  await waitForServer(startUrl);
  return startUrl;
}

async function bootstrap() {
  const devUrl = process.env.ELECTRON_START_URL;
  const startUrl = devUrl || (await startEmbeddedServer());
  createWindow(startUrl);
}

app.whenReady().then(async () => {
  try {
    await bootstrap();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const startUrl = process.env.ELECTRON_START_URL || `http://127.0.0.1:${appPort}`;
        createWindow(startUrl);
      }
    });
  } catch (error) {
    dialog.showErrorBox("Fixed Asset Manager", error.message || "Failed to start desktop app.");
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
  if (databaseInstance) {
    databaseInstance.close();
    databaseInstance = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
