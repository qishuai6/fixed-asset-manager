export const ASSET_STATUSES = {
  IN_STOCK: "在库",
  ASSIGNED: "已分配",
  IDLE: "已归还/闲置",
  RETIRED: "已报废",
  DEACTIVATED: "已停用"
};

export const TRANSACTION_TYPES = {
  CREATE: "入库",
  ASSIGN: "分配",
  RETURN: "归还",
  RETIRE: "报废",
  EDIT: "编辑",
  DEACTIVATE: "停用"
};

export const ACTIVE_EMPLOYEE_STATUSES = new Set(["在职", "试用", "实习"]);

export const IMPORT_FIELD_ALIASES = {
  assets: {
    assetCode: ["资产编号", "编号", "固定资产编号", "assetCode", "code"],
    name: ["名称", "资产名称", "固定资产名称", "name"],
    category: ["分类", "资产分类", "category"],
    status: ["状态", "资产状态", "status"],
    employeeName: ["使用人", "当前使用人", "领用人", "employeeName", "userName"],
    location: ["部门/位置", "位置", "所在位置", "location", "office"],
    assignedDate: ["领用日期", "分配日期", "assignedDate"],
    notes: ["备注", "说明", "notes"]
  },
  employees: {
    employeeCode: ["员工编号", "工号", "employeeCode", "code"],
    name: ["姓名", "员工姓名", "name"],
    department: ["部门", "所属部门", "department"],
    title: ["岗位", "职位", "title", "jobTitle"],
    employmentStatus: ["在职状态", "状态", "employmentStatus", "status"],
    notes: ["备注", "说明", "notes"]
  }
};
