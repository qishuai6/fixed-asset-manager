# 轻量固资管理系统

一个面向 `1-2` 位管理员的本地单机网页工具，核心是：

- 一屏看全局资产状态
- 一屏快速办理分配 / 归还 / 报废 / 停用
- Excel / CSV 快速导入固资和人员

## 启动

### 1. 安装依赖

```bash
cd /Users/qishuai/codex/pm/fixed-asset-manager
npm install
```

### 2. 开发模式

```bash
npm run dev
```

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8899`

### 3. 生产模式

```bash
npm run build
npm start
```

生产启动后直接打开：

- `http://127.0.0.1:8899`

## 测试

```bash
npm test
```

已覆盖：

- 新增资产后看板和列表同步更新
- 分配 / 归还 / 报废 / 停用核心流程
- 停用员工不可再被分配资产
- Excel / CSV 导入
- 重复资产编号拦截
- 首页闲置卡片与列表筛选一致

## 数据文件

- SQLite：`/Users/qishuai/codex/pm/fixed-asset-manager/data/fixed-assets.sqlite`
- 上传预览不落库存档，导入确认后直接写库

## 导入模板

- 固资模板：`/Users/qishuai/codex/pm/fixed-asset-manager/public/templates/assets-template.csv`
- 人员模板：`/Users/qishuai/codex/pm/fixed-asset-manager/public/templates/employees-template.csv`
