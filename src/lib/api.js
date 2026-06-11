async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    if (payload?.error) {
      throw new Error(payload.error);
    }
    if (response.status === 404 && url.includes("/api/asset-categories")) {
      throw new Error("当前后端还是旧版本，缺少分类接口。刷新服务后即可恢复。");
    }
    throw new Error(`接口请求失败：${response.status}`);
  }

  if (!payload?.ok) {
    throw new Error(payload?.error || "请求失败");
  }
  return payload.data;
}

export const api = {
  getDashboard: () => request("/api/dashboard"),
  getAssets: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, value);
      }
    });
    return request(`/api/assets?${query.toString()}`);
  },
  createAsset: (payload) => request("/api/assets", { method: "POST", body: JSON.stringify(payload) }),
  updateAsset: (id, payload) => request(`/api/assets/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  assignAsset: (id, payload) => request(`/api/assets/${id}/assign`, { method: "POST", body: JSON.stringify(payload) }),
  returnAsset: (id, payload) => request(`/api/assets/${id}/return`, { method: "POST", body: JSON.stringify(payload) }),
  retireAsset: (id, payload) => request(`/api/assets/${id}/retire`, { method: "POST", body: JSON.stringify(payload) }),
  deactivateAsset: (id, payload) => request(`/api/assets/${id}/deactivate`, { method: "POST", body: JSON.stringify(payload) }),
  getCategories: () => request("/api/asset-categories"),
  createCategory: (payload) => request("/api/asset-categories", { method: "POST", body: JSON.stringify(payload) }),
  updateCategory: (id, payload) =>
    request(`/api/asset-categories/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  getEmployees: () => request("/api/employees"),
  getEmployeeAssets: (id) => request(`/api/employees/${id}/assets`),
  previewImport: (type, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/import/${type}/preview`, { method: "POST", body: formData });
  },
  commitImport: (type, importToken) =>
    request(`/api/import/${type}`, {
      method: "POST",
      body: JSON.stringify({ importToken })
    })
};
