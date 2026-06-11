# Fixed Asset Manager

一个轻量的固定资产管理系统，适合公司内部 `1-2` 位行政 / IT / 资产管理员使用。

目标不是做复杂 ERP，而是把下面几件事做得足够轻、足够快：

- 一眼看清当前资产状态
- 快速办理新增、分配、归还、报废、停用
- Excel / CSV 快速导入固资清单和人员名单
- 本地部署，开箱即用，不依赖外部数据库

## 产品特点

- `单机轻量`：本地运行，数据存在本机 SQLite
- `操作简单`：核心流程尽量收敛在一屏内完成
- `导入友好`：支持 Excel / CSV 预览后导入
- `台账清晰`：每次办理都有流水记录
- `适合内部工具`：不做复杂权限、审批流、折旧系统

## 当前功能

### 1. 首页看板

- 资产总数
- 在用中
- 闲置中
- 已报废
- 已停用
- 最近办理记录
- 分类分布

### 2. 资产管理

- 新增资产
- 编辑资产
- 快速分配
- 快速归还
- 快速报废
- 停用资产
- 资产编号 / 名称 / 使用人搜索
- 按状态筛选
- 按分类筛选

### 3. 人员管理

- 导入人员名单
- 查看员工名下资产
- 拦截停用员工继续分配资产

### 4. 分类管理

- 新增分类
- 编辑分类
- 分类重命名后同步更新已有资产

### 5. 批量导入

- 导入固资清单
- 导入人员名单
- 导入前预览
- 重复资产编号拦截
- 非法数据拦截

## 技术栈

- Frontend: React + Vite
- Backend: Express
- Database: SQLite (`better-sqlite3`)
- Desktop Packaging: Electron + electron-builder

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8899`

### 构建生产前端

```bash
npm run build
```

### 启动本地生产服务

```bash
npm start
```

然后打开：

- `http://127.0.0.1:8899`

## 桌面客户端

### Windows 安装版

已支持打包 Windows 客户端安装包，安装后用户：

- 不需要安装 Node.js
- 不需要手动启动服务
- 不需要配置数据库
- 双击桌面快捷方式即可使用

相关说明见：

- [WINDOWS_INSTALL_GUIDE.md](./WINDOWS_INSTALL_GUIDE.md)

### 打包命令

```bash
npm run package:win
```

如需便携版：

```bash
npm run package:win:portable
```

如需 macOS 安装包：

```bash
npm run package:mac
```

## 测试

```bash
npm test
```

当前自动化测试已覆盖：

- 新增资产后看板和列表同步更新
- 分配 / 归还 / 报废 / 停用核心流程
- 停用员工不可再被分配资产
- Excel / CSV 导入
- 重复资产编号拦截
- 首页闲置卡片与列表筛选一致
- 资产分类新增与编辑同步

## 数据存储

开发环境默认数据库：

- `data/fixed-assets.sqlite`

桌面客户端会把数据自动写到当前系统用户自己的本地应用目录。

## 导入模板

- [assets-template.csv](./public/templates/assets-template.csv)
- [employees-template.csv](./public/templates/employees-template.csv)

## 适用场景

适合：

- 小团队行政资产管理
- IT 设备分配记录
- 电脑 / 显示器 / 办公家具台账
- 单机本地内部工具

暂不覆盖：

- 多人协同在线系统
- 复杂权限体系
- 审批流
- 借用 / 维修 / 调拨全流程
- 财务折旧

## 相关说明

- [DELIVERY_GUIDE.md](./DELIVERY_GUIDE.md)
- [WINDOWS_INSTALL_GUIDE.md](./WINDOWS_INSTALL_GUIDE.md)
