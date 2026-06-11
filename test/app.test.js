import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import XLSX from "xlsx";
import { createApp } from "../server/app.js";

function createTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fixed-asset-manager-"));
  return {
    root,
    dataDir: path.join(root, "data"),
    dbPath: path.join(root, "data", "test.sqlite")
  };
}

function createServer() {
  const workspace = createTempWorkspace();
  const { app, db } = createApp(workspace);
  return {
    api: request(app),
    cleanup() {
      db.close();
      fs.rmSync(workspace.root, { recursive: true, force: true });
    },
    workspace
  };
}

function writeCsv(filePath, header, rows) {
  const content = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  fs.writeFileSync(filePath, content, "utf8");
}

function writeXlsx(filePath, rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);
}

test("新增资产后看板和列表同步更新", async () => {
  const server = createServer();

  try {
    const createResponse = await server.api.post("/api/assets").send({
      assetCode: "NB-001",
      name: "MacBook Pro",
      category: "电脑",
      currentLocation: "行政仓"
    });

    assert.equal(createResponse.body.ok, true);

    const dashboardResponse = await server.api.get("/api/dashboard");
    assert.equal(dashboardResponse.body.data.totals.totalAssets, 1);
    assert.equal(dashboardResponse.body.data.totals.idle, 1);

    const assetsResponse = await server.api.get("/api/assets");
    assert.equal(assetsResponse.body.data.length, 1);
    assert.equal(assetsResponse.body.data[0].assetCode, "NB-001");
  } finally {
    server.cleanup();
  }
});

test("人员导入、分配归还、报废和停用规则生效", async () => {
  const server = createServer();

  try {
    const employeeCsv = path.join(server.workspace.root, "employees.csv");
    writeCsv(
      employeeCsv,
      ["员工编号", "姓名", "部门", "岗位", "在职状态"],
      [
        ["E001", "张三", "行政部", "行政", "在职"],
        ["E002", "李四", "财务部", "会计", "停用"]
      ]
    );

    const employeePreview = await server.api.post("/api/import/employees/preview").attach("file", employeeCsv);
    assert.equal(employeePreview.body.ok, true);
    const employeeImport = await server.api.post("/api/import/employees").send({
      importToken: employeePreview.body.data.importToken
    });
    assert.equal(employeeImport.body.data.importedCount, 2);

    const employeesResponse = await server.api.get("/api/employees");
    const activeEmployee = employeesResponse.body.data.find((item) => item.employeeCode === "E001");
    const inactiveEmployee = employeesResponse.body.data.find((item) => item.employeeCode === "E002");

    const assetResponse = await server.api.post("/api/assets").send({
      assetCode: "LT-001",
      name: "联想笔记本",
      category: "电脑",
      currentLocation: "库房A"
    });

    const assetId = assetResponse.body.data.id;

    const assignActive = await server.api.post(`/api/assets/${assetId}/assign`).send({
      employeeId: activeEmployee.id,
      assignedDate: "2026-06-11",
      location: "3楼工位"
    });
    assert.equal(assignActive.body.data.status, "已分配");
    assert.equal(assignActive.body.data.currentEmployeeName, "张三");

    const assignInactive = await server.api.post(`/api/assets/${assetId}/assign`).send({
      employeeId: inactiveEmployee.id,
      assignedDate: "2026-06-11",
      location: "财务区"
    });
    assert.equal(assignInactive.body.ok, false);

    const returnResponse = await server.api.post(`/api/assets/${assetId}/return`).send({
      location: "库房B",
      notes: "已回收"
    });
    assert.equal(returnResponse.body.data.status, "已归还/闲置");
    assert.equal(returnResponse.body.data.currentEmployeeName, "");

    const retireResponse = await server.api.post(`/api/assets/${assetId}/retire`).send({
      notes: "故障不可修复"
    });
    assert.equal(retireResponse.body.data.status, "已报废");

    const assignAfterRetire = await server.api.post(`/api/assets/${assetId}/assign`).send({
      employeeId: activeEmployee.id,
      assignedDate: "2026-06-11",
      location: "3楼工位"
    });
    assert.equal(assignAfterRetire.body.ok, false);

    const secondAsset = await server.api.post("/api/assets").send({
      assetCode: "CHAIR-001",
      name: "人体工学椅",
      category: "家具"
    });
    const deactivateResponse = await server.api.post(`/api/assets/${secondAsset.body.data.id}/deactivate`).send({
      notes: "信息录错，先停用"
    });
    assert.equal(deactivateResponse.body.data.status, "已停用");

    const defaultAssets = await server.api.get("/api/assets");
    assert.equal(defaultAssets.body.data.some((item) => item.assetCode === "CHAIR-001"), false);
    const allAssets = await server.api.get("/api/assets").query({ includeDeactivated: "true" });
    assert.equal(allAssets.body.data.some((item) => item.assetCode === "CHAIR-001"), true);

    const dashboard = await server.api.get("/api/dashboard");
    assert.equal(dashboard.body.data.totals.totalAssets, 1);
    assert.equal(dashboard.body.data.totals.deactivated, 1);
    assert.equal(dashboard.body.data.recentTransactions[0].actionType, "停用");
  } finally {
    server.cleanup();
  }
});

test("导入固资 Excel 时拦截重复资产编号并可导入有效行", async () => {
  const server = createServer();

  try {
    await server.api.post("/api/assets").send({
      assetCode: "DUP-001",
      name: "旧设备",
      category: "电脑"
    });

    const xlsxPath = path.join(server.workspace.root, "assets.xlsx");
    writeXlsx(xlsxPath, [
      {
        资产编号: "DUP-001",
        名称: "重复设备",
        分类: "电脑",
        状态: "在库",
        使用人: "",
        "部门/位置": "仓库",
        领用日期: "",
        备注: ""
      },
      {
        资产编号: "NEW-001",
        名称: "新设备",
        分类: "显示器",
        状态: "在库",
        使用人: "",
        "部门/位置": "仓库",
        领用日期: "",
        备注: ""
      }
    ]);

    const previewResponse = await server.api.post("/api/import/assets/preview").attach("file", xlsxPath);
    assert.equal(previewResponse.body.ok, true);
    assert.equal(previewResponse.body.data.duplicates.length, 1);
    assert.equal(previewResponse.body.data.errors.length, 0);

    const commitResponse = await server.api.post("/api/import/assets").send({
      importToken: previewResponse.body.data.importToken
    });

    assert.equal(commitResponse.body.data.importedCount, 1);
    assert.equal(commitResponse.body.data.skippedCount, 1);

    const assetsResponse = await server.api.get("/api/assets").query({ includeDeactivated: "true" });
    assert.equal(assetsResponse.body.data.length, 2);
  } finally {
    server.cleanup();
  }
});

test("首页闲置卡片对应列表筛选结果", async () => {
  const server = createServer();

  try {
    await server.api.post("/api/assets").send({ assetCode: "IDLE-1", name: "键盘", category: "外设" });
    await server.api.post("/api/assets").send({ assetCode: "IDLE-2", name: "鼠标", category: "外设", status: "已归还/闲置" });
    await server.api.post("/api/assets").send({ assetCode: "USED-1", name: "手机", category: "设备", status: "已报废" });

    const dashboard = await server.api.get("/api/dashboard");
    const idleTotal = dashboard.body.data.totals.idle;

    const filtered = await server.api.get("/api/assets").query({ status: "__idle__" });
    assert.equal(filtered.body.data.length, idleTotal);
  } finally {
    server.cleanup();
  }
});

test("资产分类可新增并编辑，编辑后同步到资产", async () => {
  const server = createServer();

  try {
    const createCategory = await server.api.post("/api/asset-categories").send({ name: "电脑设备" });
    assert.equal(createCategory.body.ok, true);

    const asset = await server.api.post("/api/assets").send({
      assetCode: "PC-001",
      name: "办公电脑",
      category: "电脑设备"
    });

    const categoryId = createCategory.body.data.id;
    const updateCategory = await server.api.put(`/api/asset-categories/${categoryId}`).send({ name: "电脑" });
    assert.equal(updateCategory.body.ok, true);
    assert.equal(updateCategory.body.data.name, "电脑");

    const assets = await server.api.get("/api/assets");
    assert.equal(assets.body.data[0].category, "电脑");

    const categories = await server.api.get("/api/asset-categories");
    assert.equal(categories.body.data[0].name, "电脑");
    assert.equal(categories.body.data[0].assetCount, 1);
    assert.equal(asset.body.ok, true);
  } finally {
    server.cleanup();
  }
});
