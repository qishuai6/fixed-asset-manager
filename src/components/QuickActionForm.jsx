import { useMemo, useState } from "react";

export function QuickActionForm({ type, asset, employees, onSubmit, submitting }) {
  const [employeeId, setEmployeeId] = useState("");
  const [location, setLocation] = useState(asset?.currentLocation || "");
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((item) => String(item.id) === String(employeeId)),
    [employees, employeeId]
  );

  function handleSubmit(event) {
    event.preventDefault();
    if (type === "assign") {
      onSubmit({ employeeId, assignedDate, location, notes });
      return;
    }
    onSubmit({ location, notes });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <div className="summary-banner">
        <strong>{asset?.assetCode}</strong>
        <span>{asset?.name}</span>
      </div>

      {type === "assign" ? (
        <>
          <label>
            <span>分配给谁</span>
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
              <option value="">请选择同事</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} {employee.department ? `· ${employee.department}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>部门</span>
            <input value={selectedEmployee?.department || ""} readOnly placeholder="选人后自动带出" />
          </label>
          <label>
            <span>领用日期</span>
            <input type="date" value={assignedDate} onChange={(event) => setAssignedDate(event.target.value)} />
          </label>
        </>
      ) : null}

      <label>
        <span>{type === "return" ? "回收位置" : type === "retire" ? "当前位置" : "停用备注"}</span>
        <input value={location} onChange={(event) => setLocation(event.target.value)} />
      </label>

      <label>
        <span>备注</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "提交中..." : type === "assign" ? "确认分配" : type === "return" ? "确认归还" : type === "retire" ? "确认报废" : "确认停用"}
        </button>
      </div>
    </form>
  );
}
