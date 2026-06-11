import { useState } from "react";
import { api } from "../lib/api.js";

export function ImportDialog({ type, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  async function handlePreview() {
    if (!file) return;
    try {
      setLoading(true);
      setError("");
      const result = await api.previewImport(type, file);
      setPreview(result);
    } catch (previewError) {
      setError(previewError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!preview?.importToken) return;
    try {
      setCommitting(true);
      setError("");
      const result = await api.commitImport(type, preview.importToken);
      onImported(result);
    } catch (commitError) {
      setError(commitError.message);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="import-panel">
      <div className="import-upload">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <button className="primary-button" onClick={handlePreview} disabled={!file || loading}>
          {loading ? "解析中..." : "1. 上传并预览"}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {preview ? (
        <div className="import-results">
          <div className="import-meta">
            <span>总行数：{preview.totalRows}</span>
            <span>错误：{preview.errors.length}</span>
            <span>重复：{preview.duplicates.length}</span>
          </div>

          <div className="mapping-grid">
            {Object.entries(preview.mappedColumns).map(([field, source]) => (
              <div key={field} className="mapping-card">
                <strong>{field}</strong>
                <span>{source || "未匹配"}</span>
              </div>
            ))}
          </div>

          <div className="table-shell compact">
            <table>
              <thead>
                <tr>
                  {preview.previewRows[0]
                    ? Object.keys(preview.previewRows[0]).map((key) => <th key={key}>{key}</th>)
                    : null}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, index) => (
                  <tr key={index}>
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key}>{value || "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.errors.length ? (
            <div className="warning-box">
              <strong>错误项</strong>
              <ul>
                {preview.errors.map((item, index) => (
                  <li key={index}>
                    第 {item.row} 行：{item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.duplicates.length ? (
            <div className="warning-box">
              <strong>重复项</strong>
              <ul>
                {preview.duplicates.map((item, index) => (
                  <li key={index}>
                    第 {item.row} 行：{item.assetCode} - {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            className="primary-button"
            onClick={handleCommit}
            disabled={committing || preview.errors.length > 0}
          >
            {committing ? "导入中..." : "5. 确认导入"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
