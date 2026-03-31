/**
 * TTP2026 看板 REST API 客户端
 * 替换原有 tRPC 调用，连接 Python FastAPI 后端
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ==================== 请求工具 ====================

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("ttp2026_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `请求失败: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ==================== 类型定义 ====================

export interface UserInfo {
  id: number;
  username: string;
  display_name: string | null;
  role: "admin" | "member" | "viewer";
  committee_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TaskData {
  id: string;
  committee_id: string;
  name: string;
  goal?: string;
  strategy?: string;
  milestone?: string;
  result?: string;
  breakthrough?: string;
  manager?: string;
  deadline?: string;
  status: "待启动" | "进行中" | "有卡点" | "已完成" | "已结束";
  completion_rate: number;
  reward_pool?: string;
  created_at: string;
  updated_at: string;
}

export interface OutcomeData {
  id: number;
  task_id: string;
  committee_id: string;
  type: "提效" | "降本" | "增收";
  scenario: string;
  before_value: number;
  after_value: number;
  unit: string;
  frequency: number;
  remark?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface CommitteeConfig {
  id: string;
  full_name?: string;
  short_name?: string;
  chairman?: string;
  director?: string;
  annual_goal?: string;
  reward_pool?: string;
  committee_status: "active" | "paused" | "terminated";
  sort_order: number;
  ding_talk_webhook?: string;
  updated_at: string;
}

// ==================== 认证 API ====================

export const authApi = {
  login: (username: string, password: string) =>
    post<{ access_token: string; token_type: string; user: UserInfo }>(
      "/api/auth/login",
      { username, password }
    ),
  me: () => get<UserInfo>("/api/auth/me"),
  register: (data: {
    username: string;
    password: string;
    display_name?: string;
    role?: string;
    committee_id?: string;
  }) => post<UserInfo>("/api/auth/register", data),
};

// ==================== 任务 API ====================

export const tasksApi = {
  list: (params?: { committee_id?: string; status?: string }) => {
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
      : "";
    return get<TaskData[]>(`/api/tasks/${qs}`);
  },
  get: (id: string) => get<TaskData>(`/api/tasks/${id}`),
  create: (data: Partial<TaskData>) => post<TaskData>("/api/tasks/", data),
  update: (id: string, data: Partial<TaskData>) =>
    patch<TaskData>(`/api/tasks/${id}`, data),
  delete: (id: string) => del<{ message: string }>(`/api/tasks/${id}`),
  stats: () => get<{
    total: number;
    inProgress: number;
    blocked: number;
    done: number;
    pending: number;
    newThisWeek: number;
    doneThisWeek: number;
  }>("/api/tasks/stats"),
  weeklyTrend: () =>
    get<{ label: string; done: number }[]>("/api/tasks/weekly-trend"),
  committeeWeeklyStats: () =>
    get<Record<string, { newCount: number; doneCount: number }>>(
      "/api/tasks/committee-weekly-stats"
    ),
};

// ==================== 效益核算 API ====================

export const outcomesApi = {
  listByTask: (taskId: string) =>
    get<OutcomeData[]>(`/api/outcomes/task/${taskId}`),
  listByCommittee: (committeeId: string) =>
    get<OutcomeData[]>(`/api/outcomes/committee/${committeeId}`),
  globalSummary: () =>
    get<Record<string, { 提效: number; 降本: number; 增收: number; count: number; annual_value: number }>>(
      "/api/outcomes/summary/global"
    ),
  committeeSummary: (committeeId: string) =>
    get<{
      total_annual_value: number;
      avg_roi: number;
      count: number;
      ti_xiao_hours: number;
      jiang_ben_yuan: number;
      zeng_shou_wan: number;
    }>(`/api/outcomes/summary/committee/${committeeId}`),
  create: (data: Omit<OutcomeData, "id" | "created_at" | "updated_at" | "created_by">) =>
    post<OutcomeData>("/api/outcomes/", data),
  update: (id: number, data: Partial<OutcomeData>) =>
    patch<OutcomeData>(`/api/outcomes/${id}`, data),
  delete: (id: number) => del<{ message: string }>(`/api/outcomes/${id}`),
};

// ==================== 部门配置 API ====================

export const committeesApi = {
  listConfigs: () => get<CommitteeConfig[]>("/api/committees/configs"),
  getConfig: (id: string) => get<CommitteeConfig>(`/api/committees/configs/${id}`),
  createConfig: (data: Partial<CommitteeConfig>) =>
    post<CommitteeConfig>("/api/committees/configs", data),
  updateConfig: (id: string, data: Partial<CommitteeConfig>) =>
    patch<CommitteeConfig>(`/api/committees/configs/${id}`, data),
  deleteConfig: (id: string) =>
    del<{ message: string }>(`/api/committees/configs/${id}`),
  systemConfigs: () =>
    get<{ config_key: string; config_value: string; description: string; updated_at: string }[]>(
      "/api/committees/system-configs"
    ),
  updateSystemConfig: (key: string, value: string) =>
    patch<{ config_key: string; config_value: string }>(
      `/api/committees/system-configs/${key}`,
      { config_value: value }
    ),
};

// ==================== 用户管理 API ====================

export const usersApi = {
  list: () => get<UserInfo[]>("/api/users/"),
  get: (id: number) => get<UserInfo>(`/api/users/${id}`),
  update: (id: number, data: Partial<UserInfo>) =>
    patch<UserInfo>(`/api/users/${id}`, data),
  delete: (id: number) => del<{ message: string }>(`/api/users/${id}`),
  resetPassword: (id: number, newPassword: string) =>
    post<{ message: string }>(`/api/users/${id}/reset-password?new_password=${encodeURIComponent(newPassword)}`, {}),
  leaderboard: () =>
    get<{ userId: number; username: string; displayName: string; committeeId: string; totalPoints: number }[]>(
      "/api/users/scores/leaderboard"
    ),
};

// ==================== 认证状态管理 ====================

export const authStore = {
  getToken: () => localStorage.getItem("ttp2026_token"),
  setToken: (token: string) => localStorage.setItem("ttp2026_token", token),
  clearToken: () => localStorage.removeItem("ttp2026_token"),
  getUser: (): UserInfo | null => {
    const raw = localStorage.getItem("ttp2026_user");
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user: UserInfo) =>
    localStorage.setItem("ttp2026_user", JSON.stringify(user)),
  clearUser: () => localStorage.removeItem("ttp2026_user"),
  logout: () => {
    authStore.clearToken();
    authStore.clearUser();
  },
};
