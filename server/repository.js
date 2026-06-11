import { ACTIVE_EMPLOYEE_STATUSES, ASSET_STATUSES, TRANSACTION_TYPES } from "./constants.js";

function nowIso() {
  return new Date().toISOString();
}

function snapshotAsset(asset) {
  return JSON.stringify({
    id: asset.id,
    assetCode: asset.asset_code,
    name: asset.name,
    category: asset.category,
    status: asset.status,
    currentEmployeeId: asset.current_employee_id,
    currentEmployeeName: asset.current_employee_name,
    currentDepartment: asset.current_department,
    currentLocation: asset.current_location,
    assignedDate: asset.assigned_date,
    notes: asset.notes,
    isDeactivated: Boolean(asset.is_deactivated),
    qrCodeValue: asset.qr_code_value
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function mapAsset(row) {
  return {
    id: row.id,
    assetCode: row.asset_code,
    name: row.name,
    category: row.category,
    status: row.status,
    currentEmployeeId: row.current_employee_id,
    currentEmployeeName: row.current_employee_name,
    currentDepartment: row.current_department,
    currentLocation: row.current_location,
    assignedDate: row.assigned_date,
    notes: row.notes,
    isDeactivated: Boolean(row.is_deactivated),
    qrCodeValue: row.qr_code_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEmployee(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    department: row.department,
    title: row.title,
    employmentStatus: row.employment_status,
    notes: row.notes,
    isActive: Boolean(row.is_active),
    assetCount: row.asset_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createRepository(db) {
  const getAssetRowById = db.prepare("SELECT * FROM assets WHERE id = ?");
  const getEmployeeRowById = db.prepare("SELECT * FROM employees WHERE id = ?");
  const getEmployeeByCode = db.prepare("SELECT * FROM employees WHERE employee_code = ?");
  const getEmployeeByName = db.prepare("SELECT * FROM employees WHERE name = ? ORDER BY is_active DESC, id DESC LIMIT 1");
  const getAssetByCode = db.prepare("SELECT * FROM assets WHERE asset_code = ?");
  const getCategoryById = db.prepare("SELECT * FROM asset_categories WHERE id = ?");
  const getCategoryByName = db.prepare("SELECT * FROM asset_categories WHERE name = ?");

  const insertTransaction = db.prepare(`
    INSERT INTO asset_transactions (
      asset_id, action_type, operator_name, target_employee_id, target_employee_name, before_snapshot, after_snapshot, notes, created_at
    ) VALUES (
      @assetId, @actionType, @operatorName, @targetEmployeeId, @targetEmployeeName, @beforeSnapshot, @afterSnapshot, @notes, @createdAt
    )
  `);

  function ensureCategoryExists(name) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) return null;

    const existing = getCategoryByName.get(normalizedName);
    if (existing) return existing;

    const createdAt = nowIso();
    const result = db.prepare(`
      INSERT INTO asset_categories (name, is_active, created_at, updated_at)
      VALUES (?, 1, ?, ?)
    `).run(normalizedName, createdAt, createdAt);

    return getCategoryById.get(result.lastInsertRowid);
  }

  db.prepare(`
    SELECT DISTINCT category
    FROM assets
    WHERE TRIM(category) != ''
  `)
    .all()
    .forEach((row) => ensureCategoryExists(row.category));

  function ensureEmployeeAssignable(employeeId) {
    const employee = getEmployeeRowById.get(employeeId);
    if (!employee) {
      throw new Error("所选员工不存在");
    }
    if (!employee.is_active || !ACTIVE_EMPLOYEE_STATUSES.has(normalizeText(employee.employment_status) || "在职")) {
      throw new Error("已停用或非在职人员不可分配新资产");
    }
    return employee;
  }

  function ensureAssetEditable(asset) {
    if (!asset) {
      throw new Error("资产不存在");
    }
    return asset;
  }

  function logTransaction(assetId, actionType, beforeRow, afterRow, options = {}) {
    insertTransaction.run({
      assetId,
      actionType,
      operatorName: normalizeText(options.operatorName),
      targetEmployeeId: options.targetEmployeeId ?? null,
      targetEmployeeName: normalizeText(options.targetEmployeeName),
      beforeSnapshot: beforeRow ? snapshotAsset(beforeRow) : "{}",
      afterSnapshot: afterRow ? snapshotAsset(afterRow) : "{}",
      notes: normalizeText(options.notes),
      createdAt: nowIso()
    });
  }

  function listAssets({ search = "", status = "", category = "", includeDeactivated = false } = {}) {
    const clauses = [];
    const params = {};

    if (search) {
      clauses.push("(asset_code LIKE @search OR name LIKE @search OR current_employee_name LIKE @search)");
      params.search = `%${search}%`;
    }
    if (status) {
      if (status === "__idle__") {
        clauses.push("(status = @idleStatus OR status = @stockStatus)");
        params.idleStatus = ASSET_STATUSES.IDLE;
        params.stockStatus = ASSET_STATUSES.IN_STOCK;
      } else {
        clauses.push("status = @status");
        params.status = status;
      }
    }
    if (category) {
      clauses.push("category = @category");
      params.category = category;
    }
    if (!includeDeactivated) {
      clauses.push("is_deactivated = 0");
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db
      .prepare(`SELECT * FROM assets ${where} ORDER BY updated_at DESC, id DESC`)
      .all(params);

    return rows.map(mapAsset);
  }

  function listEmployees({ includeInactive = true } = {}) {
    const where = includeInactive ? "" : "WHERE e.is_active = 1";
    const rows = db
      .prepare(`
        SELECT e.*, COUNT(a.id) AS asset_count
        FROM employees e
        LEFT JOIN assets a
          ON a.current_employee_id = e.id
         AND a.is_deactivated = 0
         AND a.status = '${ASSET_STATUSES.ASSIGNED}'
        ${where}
        GROUP BY e.id
        ORDER BY e.is_active DESC, e.department ASC, e.name ASC
      `)
      .all();

    return rows.map(mapEmployee);
  }

  function listEmployeeAssets(employeeId) {
    return db
      .prepare(`
        SELECT * FROM assets
        WHERE current_employee_id = ?
          AND is_deactivated = 0
        ORDER BY updated_at DESC, id DESC
      `)
      .all(employeeId)
      .map(mapAsset);
  }

  function createAsset(input) {
    const assetCode = normalizeText(input.assetCode);
    const name = normalizeText(input.name);
    if (!assetCode) throw new Error("资产编号不能为空");
    if (!name) throw new Error("资产名称不能为空");
    if (getAssetByCode.get(assetCode)) throw new Error("资产编号已存在");

    const createdAt = nowIso();
    const category = normalizeText(input.category);
    if (category) ensureCategoryExists(category);
    const status = normalizeText(input.status) || ASSET_STATUSES.IN_STOCK;
    const payload = {
      asset_code: assetCode,
      name,
      category,
      status,
      current_employee_id: null,
      current_employee_name: "",
      current_department: "",
      current_location: normalizeText(input.currentLocation || input.location),
      assigned_date: normalizeText(input.assignedDate),
      notes: normalizeText(input.notes),
      is_deactivated: status === ASSET_STATUSES.DEACTIVATED ? 1 : 0,
      qr_code_value: normalizeText(input.qrCodeValue || assetCode),
      created_at: createdAt,
      updated_at: createdAt
    };

    const tx = db.transaction(() => {
      const result = db
        .prepare(`
          INSERT INTO assets (
            asset_code, name, category, status, current_employee_id, current_employee_name,
            current_department, current_location, assigned_date, notes, is_deactivated,
            qr_code_value, created_at, updated_at
          ) VALUES (
            @asset_code, @name, @category, @status, @current_employee_id, @current_employee_name,
            @current_department, @current_location, @assigned_date, @notes, @is_deactivated,
            @qr_code_value, @created_at, @updated_at
          )
        `)
        .run(payload);

      const row = getAssetRowById.get(result.lastInsertRowid);
      logTransaction(row.id, TRANSACTION_TYPES.CREATE, null, row, { notes: input.notes });
      return mapAsset(row);
    });

    return tx();
  }

  function updateAsset(assetId, input) {
    const before = ensureAssetEditable(getAssetRowById.get(assetId));
    const assetCode = normalizeText(input.assetCode) || before.asset_code;
    const name = normalizeText(input.name) || before.name;

    const duplicate = getAssetByCode.get(assetCode);
    if (duplicate && duplicate.id !== before.id) {
      throw new Error("资产编号已存在");
    }

    const nextCategory = normalizeText(input.category) || before.category;
    if (nextCategory) ensureCategoryExists(nextCategory);

    const updated = {
      asset_code: assetCode,
      name,
      category: nextCategory,
      current_location: normalizeText(input.currentLocation ?? input.location) || before.current_location,
      notes: normalizeText(input.notes),
      updated_at: nowIso(),
      id: assetId
    };

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE assets
        SET asset_code = @asset_code,
            name = @name,
            category = @category,
            current_location = @current_location,
            notes = @notes,
            updated_at = @updated_at
        WHERE id = @id
      `).run(updated);

      const after = getAssetRowById.get(assetId);
      logTransaction(assetId, TRANSACTION_TYPES.EDIT, before, after, { notes: input.notes });
      return mapAsset(after);
    });

    return tx();
  }

  function assignAsset(assetId, input) {
    const before = ensureAssetEditable(getAssetRowById.get(assetId));
    if (before.is_deactivated || before.status === ASSET_STATUSES.DEACTIVATED) {
      throw new Error("已停用资产不可分配");
    }
    if (before.status === ASSET_STATUSES.RETIRED) {
      throw new Error("已报废资产不可分配");
    }

    const employee = ensureEmployeeAssignable(Number(input.employeeId));
    const assignedAt = normalizeText(input.assignedDate) || nowIso().slice(0, 10);
    const location = normalizeText(input.location);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE assets
        SET status = ?,
            current_employee_id = ?,
            current_employee_name = ?,
            current_department = ?,
            current_location = ?,
            assigned_date = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        ASSET_STATUSES.ASSIGNED,
        employee.id,
        employee.name,
        normalizeText(employee.department),
        location,
        assignedAt,
        nowIso(),
        assetId
      );

      const after = getAssetRowById.get(assetId);
      logTransaction(assetId, TRANSACTION_TYPES.ASSIGN, before, after, {
        targetEmployeeId: employee.id,
        targetEmployeeName: employee.name,
        notes: input.notes
      });
      return mapAsset(after);
    });

    return tx();
  }

  function returnAsset(assetId, input) {
    const before = ensureAssetEditable(getAssetRowById.get(assetId));
    if (before.status !== ASSET_STATUSES.ASSIGNED) {
      throw new Error("只有已分配资产才能归还");
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE assets
        SET status = ?,
            current_employee_id = NULL,
            current_employee_name = '',
            current_department = '',
            current_location = ?,
            assigned_date = '',
            updated_at = ?
        WHERE id = ?
      `).run(
        ASSET_STATUSES.IDLE,
        normalizeText(input.location),
        nowIso(),
        assetId
      );

      const after = getAssetRowById.get(assetId);
      logTransaction(assetId, TRANSACTION_TYPES.RETURN, before, after, { notes: input.notes });
      return mapAsset(after);
    });

    return tx();
  }

  function retireAsset(assetId, input) {
    const before = ensureAssetEditable(getAssetRowById.get(assetId));
    if (before.is_deactivated || before.status === ASSET_STATUSES.DEACTIVATED) {
      throw new Error("已停用资产不可再报废");
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE assets
        SET status = ?,
            current_employee_id = NULL,
            current_employee_name = '',
            current_department = '',
            assigned_date = '',
            updated_at = ?
        WHERE id = ?
      `).run(ASSET_STATUSES.RETIRED, nowIso(), assetId);

      const after = getAssetRowById.get(assetId);
      logTransaction(assetId, TRANSACTION_TYPES.RETIRE, before, after, { notes: input.notes });
      return mapAsset(after);
    });

    return tx();
  }

  function deactivateAsset(assetId, input) {
    const before = ensureAssetEditable(getAssetRowById.get(assetId));

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE assets
        SET status = ?,
            is_deactivated = 1,
            current_employee_id = NULL,
            current_employee_name = '',
            current_department = '',
            assigned_date = '',
            updated_at = ?
        WHERE id = ?
      `).run(ASSET_STATUSES.DEACTIVATED, nowIso(), assetId);

      const after = getAssetRowById.get(assetId);
      logTransaction(assetId, TRANSACTION_TYPES.DEACTIVATE, before, after, { notes: input.notes });
      return mapAsset(after);
    });

    return tx();
  }

  function upsertEmployee(input) {
    const employeeCode = normalizeText(input.employeeCode);
    const name = normalizeText(input.name);
    if (!name) {
      throw new Error("员工姓名不能为空");
    }

    let existing = null;
    if (employeeCode) existing = getEmployeeByCode.get(employeeCode);
    if (!existing) existing = getEmployeeByName.get(name);

    const employmentStatus = normalizeText(input.employmentStatus) || "在职";
    const isActive = employmentStatus !== "停用" && employmentStatus !== "离职" ? 1 : 0;

    if (existing) {
      db.prepare(`
        UPDATE employees
        SET employee_code = ?,
            name = ?,
            department = ?,
            title = ?,
            employment_status = ?,
            notes = ?,
            is_active = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        employeeCode || existing.employee_code,
        name,
        normalizeText(input.department),
        normalizeText(input.title),
        employmentStatus,
        normalizeText(input.notes),
        isActive,
        nowIso(),
        existing.id
      );
      return mapEmployee(getEmployeeRowById.get(existing.id));
    }

    const createdAt = nowIso();
    const result = db.prepare(`
      INSERT INTO employees (
        employee_code, name, department, title, employment_status, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeCode,
      name,
      normalizeText(input.department),
      normalizeText(input.title),
      employmentStatus,
      normalizeText(input.notes),
      isActive,
      createdAt,
      createdAt
    );

    return mapEmployee(getEmployeeRowById.get(result.lastInsertRowid));
  }

  function listCategories() {
    const rows = db.prepare(`
      SELECT c.*, COUNT(a.id) AS asset_count
      FROM asset_categories c
      LEFT JOIN assets a
        ON a.category = c.name
       AND a.is_deactivated = 0
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `).all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      assetCount: row.asset_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  function createCategory(input) {
    const name = normalizeText(input.name);
    if (!name) {
      throw new Error("分类名称不能为空");
    }
    if (getCategoryByName.get(name)) {
      throw new Error("分类名称已存在");
    }

    const createdAt = nowIso();
    const result = db.prepare(`
      INSERT INTO asset_categories (name, is_active, created_at, updated_at)
      VALUES (?, 1, ?, ?)
    `).run(name, createdAt, createdAt);

    return {
      id: result.lastInsertRowid,
      name,
      assetCount: 0,
      createdAt,
      updatedAt: createdAt
    };
  }

  function updateCategory(categoryId, input) {
    const before = getCategoryById.get(categoryId);
    if (!before || !before.is_active) {
      throw new Error("分类不存在");
    }

    const nextName = normalizeText(input.name);
    if (!nextName) {
      throw new Error("分类名称不能为空");
    }

    const duplicate = getCategoryByName.get(nextName);
    if (duplicate && duplicate.id !== before.id) {
      throw new Error("分类名称已存在");
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE asset_categories
        SET name = ?, updated_at = ?
        WHERE id = ?
      `).run(nextName, nowIso(), categoryId);

      db.prepare(`
        UPDATE assets
        SET category = ?, updated_at = ?
        WHERE category = ?
      `).run(nextName, nowIso(), before.name);

      return listCategories().find((item) => item.id === categoryId);
    });

    return tx();
  }

  function getDashboard() {
    const statusCounts = db
      .prepare(`
        SELECT status, COUNT(*) AS count
        FROM assets
        WHERE is_deactivated = 0
        GROUP BY status
      `)
      .all();

    const deactivatedCountRow = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM assets
        WHERE is_deactivated = 1
      `)
      .get();

    const categoryCounts = db
      .prepare(`
        SELECT category, COUNT(*) AS count
        FROM assets
        WHERE is_deactivated = 0
        GROUP BY category
        ORDER BY count DESC, category ASC
        LIMIT 8
      `)
      .all();

    const recentTransactions = db
      .prepare(`
        SELECT t.id, t.action_type, t.target_employee_name, t.notes, t.created_at, a.asset_code, a.name
        FROM asset_transactions t
        JOIN assets a ON a.id = t.asset_id
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT 12
      `)
      .all();

    const countMap = Object.fromEntries(statusCounts.map((item) => [item.status, item.count]));
    const totalAssets = statusCounts.reduce((sum, item) => sum + item.count, 0);

    return {
      totals: {
        totalAssets,
        assigned: countMap[ASSET_STATUSES.ASSIGNED] || 0,
        idle: (countMap[ASSET_STATUSES.IN_STOCK] || 0) + (countMap[ASSET_STATUSES.IDLE] || 0),
        retired: countMap[ASSET_STATUSES.RETIRED] || 0,
        deactivated: deactivatedCountRow?.count || 0
      },
      categoryBreakdown: categoryCounts.map((item) => ({
        category: item.category || "未分类",
        count: item.count
      })),
      recentTransactions: recentTransactions.map((item) => ({
        id: item.id,
        actionType: item.action_type,
        assetCode: item.asset_code,
        assetName: item.name,
        targetEmployeeName: item.target_employee_name,
        notes: item.notes,
        createdAt: item.created_at
      }))
    };
  }

  return {
    createAsset,
    updateAsset,
    assignAsset,
    returnAsset,
    retireAsset,
    deactivateAsset,
    upsertEmployee,
    listAssets,
    listEmployees,
    listEmployeeAssets,
    listCategories,
    createCategory,
    updateCategory,
    getDashboard,
    getAssetByCode: (code) => {
      const row = getAssetByCode.get(code);
      return row ? mapAsset(row) : null;
    },
    getEmployeeByCode: (code) => {
      const row = getEmployeeByCode.get(code);
      return row ? mapEmployee(row) : null;
    },
    findEmployeeByName: (name) => {
      const row = getEmployeeByName.get(name);
      return row ? mapEmployee(row) : null;
    }
  };
}
