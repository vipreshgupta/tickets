const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // ─── Auth ─────────────────────────────────────────────────────
  async register(email: string, password: string, name?: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await handleResponse<{ user: any; token: string }>(res);
    localStorage.setItem("auth_token", data.token);
    return data;
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ user: any; token: string }>(res);
    localStorage.setItem("auth_token", data.token);
    return data;
  },

  async me() {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: authHeaders(),
    });
    return handleResponse<{ user: any }>(res);
  },

  logout() {
    localStorage.removeItem("auth_token");
  },

  isLoggedIn(): boolean {
    return !!getToken();
  },

  // ─── Templates ────────────────────────────────────────────────
  async saveTemplate(name: string, backgroundFile: File, zones: any[]) {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("background", backgroundFile);
    formData.append("zones", JSON.stringify(zones));

    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/api/templates`, {
      method: "POST",
      headers,
      body: formData,
    });
    return handleResponse<{ template: any }>(res);
  },

  async getTemplates() {
    const res = await fetch(`${API_URL}/api/templates`, {
      headers: authHeaders(),
    });
    return handleResponse<{ templates: any[] }>(res);
  },

  async deleteTemplate(id: string) {
    const res = await fetch(`${API_URL}/api/templates/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handleResponse<{ message: string }>(res);
  },

  // ─── Batches ──────────────────────────────────────────────────
  async createBatch(data: {
    template_id?: string;
    quantity: number;
    background?: File;
    zones?: any[];
  }) {
    const formData = new FormData();
    formData.append("quantity", data.quantity.toString());

    if (data.template_id) {
      formData.append("template_id", data.template_id);
    }
    if (data.background) {
      formData.append("background", data.background);
    }
    if (data.zones) {
      formData.append("zones", JSON.stringify(data.zones));
    }

    const token = getToken();
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/api/batches`, {
      method: "POST",
      headers,
      body: formData,
    });
    return handleResponse<{ job_id: string; status: string }>(res);
  },

  async getBatch(id: string) {
    const res = await fetch(`${API_URL}/api/batches/${id}`, {
      headers: authHeaders(),
    });
    return handleResponse<{ batch: any }>(res);
  },

  subscribeBatchProgress(
    id: string,
    onMessage: (data: any) => void,
    onError?: (err: Event) => void
  ): EventSource {
    const es = new EventSource(`${API_URL}/api/batches/${id}/progress`);
    es.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // ignore parse errors
      }
    };
    if (onError) es.onerror = onError;
    return es;
  },

  async cancelBatch(id: string) {
    const res = await fetch(`${API_URL}/api/batches/${id}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handleResponse<{ message: string }>(res);
  },

  getDownloadUrl(batchId: string, type: "pdf" | "zip") {
    return `${API_URL}/api/batches/${batchId}/download/${type}`;
  },

  // ─── Verify ───────────────────────────────────────────────────
  async verifyTicket(id: string, sig: string) {
    const res = await fetch(`${API_URL}/verify?id=${id}&sig=${sig}`);
    return handleResponse<any>(res);
  },
};
