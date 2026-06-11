import { useEffect, useState } from "react";

const EMPTY_FORM = { id: null, name: "" };

export function CategoryManager({ categories, onCreate, onUpdate, submitting }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setForm(EMPTY_FORM);
  }, [categories.length]);

  function startEdit(category) {
    setForm({ id: category.id, name: category.name });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (form.id) {
      await onUpdate(form.id, { name: form.name });
    } else {
      await onCreate({ name: form.name });
    }
    setForm(EMPTY_FORM);
  }

  return (
    <div className="category-manager">
      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          <span>{form.id ? "编辑分类" : "新增分类"}</span>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如：电脑 / 显示器 / 办公家具"
            required
          />
        </label>
        <div className="form-actions split">
          {form.id ? (
            <button className="ghost-button" type="button" onClick={() => setForm(EMPTY_FORM)}>
              取消编辑
            </button>
          ) : (
            <span />
          )}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "保存中..." : form.id ? "保存分类" : "新增分类"}
          </button>
        </div>
      </form>

      <div className="category-manager-list">
        {categories.length ? (
          categories.map((category) => (
            <div key={category.id} className="category-manager-row">
              <div>
                <strong>{category.name}</strong>
                <span>使用中资产：{category.assetCount}</span>
              </div>
              <button className="link-button" onClick={() => startEdit(category)}>
                编辑
              </button>
            </div>
          ))
        ) : (
          <p className="empty-text">还没有资产分类。</p>
        )}
      </div>
    </div>
  );
}
