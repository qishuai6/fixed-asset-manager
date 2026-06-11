import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import XLSX from "xlsx";
import { ASSET_STATUSES, IMPORT_FIELD_ALIASES } from "./constants.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function findMatchingKey(headers, aliases) {
  for (const alias of aliases) {
    const found = headers.find((header) => normalizeText(header).toLowerCase() === normalizeText(alias).toLowerCase());
    if (found) return found;
  }
  return null;
}

function mapColumns(headers, type) {
  const aliases = IMPORT_FIELD_ALIASES[type];
  return Object.fromEntries(
    Object.entries(aliases).map(([field, fieldAliases]) => [field, findMatchingKey(headers, fieldAliases)])
  );
}

function parseFile(file) {
  const extension = path.extname(file.originalname || file.path || "").toLowerCase();
  if (![".xlsx", ".xls", ".csv"].includes(extension)) {
    throw new Error("仅支持 Excel 或 CSV 文件");
  }
  const content = file.buffer || fs.readFileSync(file.path);
  const workbook =
    extension === ".csv"
      ? XLSX.read(content.toString("utf8"), { type: "string", raw: false })
      : XLSX.read(content, { type: "buffer", raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function normalizeAssetRow(row, mapped) {
  return {
    assetCode: normalizeText(row[mapped.assetCode]),
    name: normalizeText(row[mapped.name]),
    category: normalizeText(row[mapped.category]),
    status: normalizeText(row[mapped.status]) || ASSET_STATUSES.IN_STOCK,
    employeeName: normalizeText(row[mapped.employeeName]),
    location: normalizeText(row[mapped.location]),
    assignedDate: normalizeText(row[mapped.assignedDate]),
    notes: normalizeText(row[mapped.notes])
  };
}

function normalizeEmployeeRow(row, mapped) {
  return {
    employeeCode: normalizeText(row[mapped.employeeCode]),
    name: normalizeText(row[mapped.name]),
    department: normalizeText(row[mapped.department]),
    title: normalizeText(row[mapped.title]),
    employmentStatus: normalizeText(row[mapped.employmentStatus]) || "在职",
    notes: normalizeText(row[mapped.notes])
  };
}

export function createImportManager(repository) {
  const sessions = new Map();

  function buildAssetPreview(rows) {
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const mapped = mapColumns(headers, "assets");
    const errors = [];
    const duplicates = [];
    const seenCodes = new Set();

    const normalizedRows = rows.map((row, index) => {
      const item = normalizeAssetRow(row, mapped);
      if (!item.assetCode) {
        errors.push({ row: index + 2, message: "资产编号不能为空" });
      }
      if (!item.name) {
        errors.push({ row: index + 2, message: "资产名称不能为空" });
      }
      if (item.assetCode) {
        if (seenCodes.has(item.assetCode)) {
          duplicates.push({ row: index + 2, assetCode: item.assetCode, message: "文件内资产编号重复" });
        }
        seenCodes.add(item.assetCode);
        if (repository.getAssetByCode(item.assetCode)) {
          duplicates.push({ row: index + 2, assetCode: item.assetCode, message: "系统内资产编号已存在" });
        }
      }
      return item;
    });

    return {
      mappedColumns: mapped,
      previewRows: normalizedRows.slice(0, 20),
      normalizedRows,
      errors,
      duplicates
    };
  }

  function buildEmployeePreview(rows) {
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const mapped = mapColumns(headers, "employees");
    const errors = [];

    const normalizedRows = rows.map((row, index) => {
      const item = normalizeEmployeeRow(row, mapped);
      if (!item.name) {
        errors.push({ row: index + 2, message: "员工姓名不能为空" });
      }
      return item;
    });

    return {
      mappedColumns: mapped,
      previewRows: normalizedRows.slice(0, 20),
      normalizedRows,
      errors,
      duplicates: []
    };
  }

  function previewImport(type, file) {
    const rows = parseFile(file);
    const result = type === "assets" ? buildAssetPreview(rows) : buildEmployeePreview(rows);
    const token = nanoid(10);

    sessions.set(token, {
      type,
      rows: result.normalizedRows,
      createdAt: Date.now()
    });

    return {
      importToken: token,
      totalRows: result.normalizedRows.length,
      mappedColumns: result.mappedColumns,
      previewRows: result.previewRows,
      errors: result.errors,
      duplicates: result.duplicates
    };
  }

  function commitImport(type, importToken) {
    const session = sessions.get(importToken);
    if (!session || session.type !== type) {
      throw new Error("导入预览已失效，请重新上传文件");
    }

    if (type === "assets") {
      const imported = [];
      const skipped = [];
      for (const row of session.rows) {
        if (!row.assetCode || !row.name || repository.getAssetByCode(row.assetCode)) {
          skipped.push(row);
          continue;
        }
        const createdAsset = repository.createAsset(row);
        if (row.employeeName) {
          const employee = repository.findEmployeeByName(row.employeeName);
          if (employee?.isActive && createdAsset.status !== ASSET_STATUSES.RETIRED && createdAsset.status !== ASSET_STATUSES.DEACTIVATED) {
            imported.push(
              repository.assignAsset(createdAsset.id, {
                employeeId: employee.id,
                assignedDate: row.assignedDate,
                location: row.location,
                notes: row.notes
              })
            );
            continue;
          }
        }
        imported.push(createdAsset);
      }
      sessions.delete(importToken);
      return { importedCount: imported.length, skippedCount: skipped.length, imported };
    }

    const imported = session.rows
      .filter((row) => row.name)
      .map((row) => repository.upsertEmployee(row));
    sessions.delete(importToken);
    return { importedCount: imported.length, skippedCount: 0, imported };
  }

  return {
    previewImport,
    commitImport
  };
}
