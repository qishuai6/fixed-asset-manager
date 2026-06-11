import { useEffect, useState } from "react";

const EMPTY_FORM = {
  assetCode: "",
  name: "",
  category: "",
  currentLocation: "",
  notes: ""
};

export function AssetForm({ asset, categories, onSubmit, submitting }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!asset) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      assetCode: asset.assetCode || "",
      name: asset.name || "",
      category: asset.category || "",
      currentLocation: asset.currentLocation || "",
      notes: asset.notes || ""
    });
  }, [asset]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="stack-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label>
        <span>资产编号</span>
        <input value={form.assetCode} onChange={(event) => updateField("assetCode", event.target.value)} required />
      </label>
      <label>
        <span>资产名称</span>
        <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
      </label>
      <label>
        <span>分类</span>
        <input
          list="asset-category-options"
          value={form.category}
          onChange={(event) => updateField("category", event.target.value)}
          placeholder="输入或选择分类"
        />
        <datalist id="asset-category-options">
          {categories.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </label>
      <label>
        <span>位置</span>
        <input
          value={form.currentLocation}
          onChange={(event) => updateField("currentLocation", event.target.value)}
          placeholder="如：行政仓 / 3楼工位"
        />
      </label>
      <label>
        <span>备注</span>
        <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={3} />
      </label>
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "保存中..." : asset ? "保存修改" : "新增资产"}
        </button>
      </div>
    </form>
  );
}
