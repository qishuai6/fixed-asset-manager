import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { ASSET_STATUSES } from "./constants.js";

export function createDatabase(dbPath) {
  const resolvedPath = dbPath === ":memory:" ? dbPath : path.resolve(dbPath);
  if (resolvedPath !== ":memory:") {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS asset_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT,
      name TEXT NOT NULL,
      department TEXT DEFAULT '',
      title TEXT DEFAULT '',
      employment_status TEXT DEFAULT '在职',
      notes TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_code_unique
    ON employees(employee_code)
    WHERE employee_code IS NOT NULL AND employee_code != '';

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '${ASSET_STATUSES.IN_STOCK}',
      current_employee_id INTEGER,
      current_employee_name TEXT DEFAULT '',
      current_department TEXT DEFAULT '',
      current_location TEXT DEFAULT '',
      assigned_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_deactivated INTEGER DEFAULT 0,
      qr_code_value TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(current_employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS asset_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      operator_name TEXT DEFAULT '',
      target_employee_id INTEGER,
      target_employee_name TEXT DEFAULT '',
      before_snapshot TEXT NOT NULL,
      after_snapshot TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY(target_employee_id) REFERENCES employees(id)
    );
  `);

  return db;
}
