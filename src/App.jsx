import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api.js";
import { Modal } from "./components/Modal.jsx";
import { AssetForm } from "./components/AssetForm.jsx";
import { QuickActionForm } from "./components/QuickActionForm.jsx";
import { ImportDialog } from "./components/ImportDialog.jsx";
import { CategoryManager } from "./components/CategoryManager.jsx";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "__idle__", label: "闲置（含在库）" },
  { value: "在库", label: "在库" },
  { value: "已分配", label: "已分配" },
  { value: "已归还/闲置", label: "已归还/闲置" },
  { value: "已报废", label: "已报废" },
  { value: "已停用", label: "已停用" }
];

const EMPTY_MODAL = { type: "", asset: null };

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function DashboardCards({ dashboard, onJump }) {
  const cards = [
    { key: "", label: "全部资产", value: dashboard.totals.totalAssets },
    { key: "已分配", label: "在用中", value: dashboard.totals.assigned },
    { key: "__idle__", label: "闲置中", value: dashboard.totals.idle },
    { key: "已报废", label: "已报废", value: dashboard.totals.retired },
    { key: "已停用", label: "已停用", value: dashboard.totals.deactivated }
  ];

  return (
    <div className="card-grid">
      {cards.map((card) => (
        <button key={card.label} className="stat-card" onClick={() => onJump(card.key)}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [view, setView] = useState("dashboard");
  const [dashboard, setDashboard] = useState({
    totals: { totalAssets: 0, assigned: 0, idle: 0, retired: 0, deactivated: 0 },
    categoryBreakdown: [],
    recentTransactions: []
  });
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeAssets, setEmployeeAssets] = useState({});
  const [filters, setFilters] = useState({ search: "", status: "", category: "", includeDeactivated: false });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => categories.map((item) => item.name), [categories]);

  async function loadAll(currentFilters = filters) {
    try {
      setLoading(true);
      const [dashboardData, assetsData, employeesData, categoryData] = await Promise.all([
        api.getDashboard(),
        api.getAssets(currentFilters),
        api.getEmployees(),
        api.getCategories()
      ]);
      setDashboard(dashboardData);
      setAssets(assetsData);
      setEmployees(employeesData);
      setCategories(categoryData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(filters);
  }, []);

  function flashSuccess(text) {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 2400);
  }

  async function refreshAfterChange(nextFilters = filters) {
    await loadAll(nextFilters);
    setModal(EMPTY_MODAL);
  }

  async function handleAssetSubmit(payload) {
    try {
      setSubmitting(true);
      if (modal.asset) {
        await api.updateAsset(modal.asset.id, payload);
        flashSuccess("资产已更新");
      } else {
        await api.createAsset(payload);
        flashSuccess("资产已新增");
      }
      await refreshAfterChange();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickAction(payload) {
    if (!modal.asset) return;
    try {
      setSubmitting(true);
      if (modal.type === "assign") {
        await api.assignAsset(modal.asset.id, payload);
        flashSuccess("已完成分配");
      } else if (modal.type === "return") {
        await api.returnAsset(modal.asset.id, payload);
        flashSuccess("已完成归还");
      } else if (modal.type === "retire") {
        await api.retireAsset(modal.asset.id, payload);
        flashSuccess("资产已报废");
      } else if (modal.type === "deactivate") {
        await api.deactivateAsset(modal.asset.id, payload);
        flashSuccess("资产已停用");
      }
      await refreshAfterChange();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function applyFilters(nextPatch) {
    const nextFilters = { ...filters, ...nextPatch };
    setFilters(nextFilters);
    await loadAll(nextFilters);
  }

  async function openEmployeeAssets(employeeId) {
    if (employeeAssets[employeeId]) {
      setEmployeeAssets((current) => ({ ...current, [employeeId]: null }));
      return;
    }
    const rows = await api.getEmployeeAssets(employeeId);
    setEmployeeAssets((current) => ({ ...current, [employeeId]: rows }));
  }

  async function handleCategoryCreate(payload) {
    try {
      setSubmitting(true);
      await api.createCategory(payload);
      flashSuccess("分类已新增");
      await loadAll(filters);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCategoryUpdate(id, payload) {
    try {
      setSubmitting(true);
      await api.updateCategory(id, payload);
      flashSuccess("分类已更新");
      await loadAll(filters);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">轻量 / 单机 / 快速办理</p>
          <h1>固资管理系统</h1>
          <p className="subcopy">先把台账和进出办理做轻，避免复杂中后台。</p>
        </div>

        <nav className="nav-stack">
          <button className={view === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => setView("dashboard")}>
            首页看板
          </button>
          <button className={view === "assets" ? "nav-item active" : "nav-item"} onClick={() => setView("assets")}>
            资产列表
          </button>
          <button className={view === "employees" ? "nav-item active" : "nav-item"} onClick={() => setView("employees")}>
            人员列表
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="primary-button" onClick={() => setModal({ type: "create", asset: null })}>
            新增资产
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <h2>{view === "dashboard" ? "总览" : view === "assets" ? "资产办理台" : "人员台账"}</h2>
            <p>{loading ? "正在同步最新数据..." : "操作尽量收敛在一屏里完成。"}</p>
          </div>
          <div className="feedback">
            {message ? <span className="success-pill">{message}</span> : null}
            {error ? <span className="error-pill">{error}</span> : null}
          </div>
        </header>

        {view === "dashboard" ? (
          <section className="page-stack">
            <DashboardCards
              dashboard={dashboard}
              onJump={(status) => {
                setView("assets");
                applyFilters({ status });
              }}
            />

            <div className="content-grid">
              <section className="panel-card">
                <div className="section-head">
                  <h3>分类分布</h3>
                </div>
                <div className="category-list">
                  {dashboard.categoryBreakdown.map((item) => (
                    <div key={item.category} className="category-row">
                      <span>{item.category}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                  {dashboard.categoryBreakdown.length === 0 ? <p className="empty-text">还没有资产数据。</p> : null}
                </div>
              </section>

              <section className="panel-card">
                <div className="section-head">
                  <h3>最近办理</h3>
                </div>
                <div className="timeline-list">
                  {dashboard.recentTransactions.map((item) => (
                    <div key={item.id} className="timeline-row">
                      <div>
                        <strong>{item.actionType}</strong>
                        <span>
                          {item.assetCode} · {item.assetName}
                        </span>
                      </div>
                      <div className="timeline-meta">
                        <span>{item.targetEmployeeName || item.notes || "-"}</span>
                        <time>{formatDateTime(item.createdAt)}</time>
                      </div>
                    </div>
                  ))}
                  {dashboard.recentTransactions.length === 0 ? <p className="empty-text">还没有办理记录。</p> : null}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {view === "assets" ? (
          <section className="page-stack">
            <div className="toolbar">
              <div className="toolbar-main">
                <input
                  className="toolbar-search"
                  placeholder="搜资产编号 / 名称 / 使用人"
                  value={filters.search}
                  onChange={(event) => applyFilters({ search: event.target.value })}
                />
                <select className="toolbar-select" value={filters.status} onChange={(event) => applyFilters({ status: event.target.value })}>
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value || "all"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select className="toolbar-select" value={filters.category} onChange={(event) => applyFilters({ category: event.target.value })}>
                  <option value="">全部分类</option>
                  {categoryOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar-actions">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={filters.includeDeactivated}
                  onChange={(event) => applyFilters({ includeDeactivated: event.target.checked })}
                />
                <span>显示停用资产</span>
              </label>
              <button className="ghost-button" onClick={() => setModal({ type: "manage-categories", asset: null })}>
                管理分类
              </button>
              <button className="ghost-button" onClick={() => setModal({ type: "import-assets", asset: null })}>
                批量导入固资
              </button>
              </div>
            </div>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>资产编号</th>
                    <th>名称</th>
                    <th>分类</th>
                    <th>状态</th>
                    <th>当前使用人</th>
                    <th>部门/位置</th>
                    <th>领用日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td>{asset.assetCode}</td>
                      <td>
                        <div className="cell-stack">
                          <strong>{asset.name}</strong>
                          {asset.notes ? <span>{asset.notes}</span> : null}
                        </div>
                      </td>
                      <td>{asset.category || "-"}</td>
                      <td>
                        <span className="status-chip">{asset.status}</span>
                      </td>
                      <td>{asset.currentEmployeeName || "-"}</td>
                      <td>{asset.currentDepartment || asset.currentLocation || "-"}</td>
                      <td>{asset.assignedDate || "-"}</td>
                      <td>
                        <div className="action-row">
                          <button className="link-button" onClick={() => setModal({ type: "edit", asset })}>
                            编辑
                          </button>
                          <button
                            className="link-button"
                            onClick={() => setModal({ type: "assign", asset })}
                            disabled={asset.status === "已报废" || asset.status === "已停用"}
                          >
                            分配
                          </button>
                          <button
                            className="link-button"
                            onClick={() => setModal({ type: "return", asset })}
                            disabled={asset.status !== "已分配"}
                          >
                            归还
                          </button>
                          <button
                            className="link-button danger"
                            onClick={() => setModal({ type: "retire", asset })}
                            disabled={asset.status === "已报废" || asset.status === "已停用"}
                          >
                            报废
                          </button>
                          <button
                            className="link-button danger"
                            onClick={() => setModal({ type: "deactivate", asset })}
                            disabled={asset.status === "已停用"}
                          >
                            停用
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!assets.length && !loading ? <p className="empty-text padded">当前筛选条件下没有资产。</p> : null}
            </div>
          </section>
        ) : null}

        {view === "employees" ? (
          <section className="page-stack">
            <div className="toolbar">
              <button className="ghost-button" onClick={() => setModal({ type: "import-employees", asset: null })}>
                批量导入人员
              </button>
            </div>

            <div className="employee-grid">
              {employees.map((employee) => (
                <div key={employee.id} className="employee-card">
                  <div className="employee-head">
                    <div>
                      <strong>{employee.name}</strong>
                      <span>
                        {employee.department || "未填部门"} {employee.title ? `· ${employee.title}` : ""}
                      </span>
                    </div>
                    <span className={employee.isActive ? "mini-pill" : "mini-pill muted"}>
                      {employee.employmentStatus}
                    </span>
                  </div>
                  <div className="employee-meta">
                    <span>工号：{employee.employeeCode || "-"}</span>
                    <span>名下资产：{employee.assetCount}</span>
                  </div>
                  <button className="link-button" onClick={() => openEmployeeAssets(employee.id)}>
                    {employeeAssets[employee.id] ? "收起资产" : "查看名下资产"}
                  </button>
                  {employeeAssets[employee.id] ? (
                    <div className="employee-assets">
                      {employeeAssets[employee.id].length ? (
                        employeeAssets[employee.id].map((asset) => (
                          <div key={asset.id} className="employee-asset-row">
                            <span>{asset.assetCode}</span>
                            <strong>{asset.name}</strong>
                          </div>
                        ))
                      ) : (
                        <p className="empty-text">当前没有分配中的资产。</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {!employees.length && !loading ? <p className="empty-text">还没有人员数据。</p> : null}
            </div>
          </section>
        ) : null}
      </main>

      <Modal
        open={modal.type === "create" || modal.type === "edit"}
        title={modal.type === "edit" ? "编辑资产" : "新增资产"}
        onClose={() => setModal(EMPTY_MODAL)}
      >
        <AssetForm asset={modal.asset} categories={categories} onSubmit={handleAssetSubmit} submitting={submitting} />
      </Modal>

      <Modal
        open={["assign", "return", "retire", "deactivate"].includes(modal.type)}
        title={
          modal.type === "assign"
            ? "快速分配"
            : modal.type === "return"
              ? "快速归还"
              : modal.type === "retire"
                ? "确认报废"
                : "确认停用"
        }
        onClose={() => setModal(EMPTY_MODAL)}
      >
        <QuickActionForm
          type={modal.type}
          asset={modal.asset}
          employees={employees.filter((employee) => employee.isActive)}
          onSubmit={handleQuickAction}
          submitting={submitting}
        />
      </Modal>

      <Modal
        open={modal.type === "import-assets" || modal.type === "import-employees"}
        title={modal.type === "import-assets" ? "导入固资清单" : "导入人员名单"}
        onClose={() => setModal(EMPTY_MODAL)}
        wide
      >
        <ImportDialog
          type={modal.type === "import-assets" ? "assets" : "employees"}
          onImported={async (result) => {
            flashSuccess(`已导入 ${result.importedCount} 条数据`);
            await refreshAfterChange();
          }}
        />
      </Modal>

      <Modal
        open={modal.type === "manage-categories"}
        title="资产分类管理"
        onClose={() => setModal(EMPTY_MODAL)}
      >
        <CategoryManager
          categories={categories}
          onCreate={handleCategoryCreate}
          onUpdate={handleCategoryUpdate}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
