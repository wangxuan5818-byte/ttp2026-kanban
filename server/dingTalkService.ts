/**
 * 钉钉服务模块
 * 使用 Node.js https 模块（绕过沙箱 fetch 超时限制）
 * 支持：获取 access_token、发送工作通知、发送群 Webhook、通讯录查询
 */

import * as https from "https";
import { ENV } from "./_core/env";

// ─── 通用 HTTPS 请求封装 ──────────────────────────────────────

function httpsRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string> },
  body?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 15000,
    };

    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timeout: ${url}`));
    });

    if (body) req.write(body);
    req.end();
  });
}

async function httpsPost<T>(url: string, payload: unknown): Promise<T> {
  const body = JSON.stringify(payload);
  const raw = await httpsRequest(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
      },
    },
    body
  );
  return JSON.parse(raw) as T;
}

async function httpsGet<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  const raw = await httpsRequest(url, { method: "GET", headers: extraHeaders || {} });
  return JSON.parse(raw) as T;
}

// ─── 类型定义 ─────────────────────────────────────────────────

interface DingTalkTokenResponse {
  accessToken: string;
  expireIn: number;
}

interface DingTalkApiResponse<T = unknown> {
  errcode?: number;
  errmsg?: string;
  result?: T;
  requestId?: string;
}

// ─── Token 缓存 ───────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * 获取钉钉 access_token（使用 OAuth2 Client Credentials）
 * 自动缓存，过期前 60s 刷新
 */
export async function getDingTalkAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = ENV.dingTalkClientId;
  const clientSecret = ENV.dingTalkClientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("钉钉 Client ID 或 Client Secret 未配置");
  }

  const data = await httpsPost<DingTalkTokenResponse>(
    "https://api.dingtalk.com/v1.0/oauth2/accessToken",
    { appKey: clientId, appSecret: clientSecret }
  );

  if (!data.accessToken) {
    throw new Error(`钉钉 access_token 响应异常: ${JSON.stringify(data)}`);
  }

  cachedToken = data.accessToken;
  tokenExpiresAt = now + (data.expireIn || 7200) * 1000;

  return cachedToken;
}

/**
 * 通过钉钉工作通知向指定用户发送消息
 */
export async function sendDingTalkWorkNotice(
  userIds: string[],
  title: string,
  content: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const token = await getDingTalkAccessToken();
    const agentId = ENV.dingTalkAgentId;

    if (!agentId) throw new Error("钉钉 AgentId 未配置");

    const data = await httpsPost<DingTalkApiResponse<{ task_id: number }>>(
      `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`,
      {
        agent_id: parseInt(agentId),
        userid_list: userIds.join(","),
        msg: { msgtype: "markdown", markdown: { title, text: content } },
      }
    );

    if (data.errcode !== 0) {
      throw new Error(`钉钉工作通知发送失败: ${data.errmsg} (${data.errcode})`);
    }

    return { success: true, taskId: String(data.result?.task_id || "") };
  } catch (err: any) {
    console.error("[DingTalk] sendWorkNotice error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 通过 Webhook 向钉钉群发送消息
 */
export async function sendDingTalkWebhookMessage(
  webhookUrl: string,
  title: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await httpsPost<{ errcode: number; errmsg: string }>(
      webhookUrl,
      { msgtype: "markdown", markdown: { title, text: content } }
    );

    if (data.errcode !== 0) {
      throw new Error(`Webhook 消息发送失败: ${data.errmsg} (${data.errcode})`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[DingTalk] sendWebhookMessage error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 构建任务状态变更通知内容（Markdown 格式）
 */
export function buildTaskStatusNotification(params: {
  taskName: string;
  committeeShortName: string;
  oldStatus: string;
  newStatus: string;
  manager?: string;
  deadline?: string;
  breakthrough?: string;
}): { title: string; content: string } {
  const { taskName, committeeShortName, oldStatus, newStatus, manager, deadline, breakthrough } = params;

  const statusEmoji: Record<string, string> = {
    "进行中": "🟢",
    "有卡点": "🔴",
    "待启动": "⚪",
    "已结束": "✅",
    "已完成": "✅",
  };

  const emoji = statusEmoji[newStatus] || "📋";
  const title = `${emoji} 任务状态变更：${taskName}`;

  let content = `## ${emoji} 任务状态变更通知\n\n`;
  content += `**任务名称：** ${taskName}\n\n`;
  content += `**所属委员会：** ${committeeShortName}\n\n`;
  content += `**状态变更：** ${oldStatus} → **${newStatus}**\n\n`;

  if (manager) content += `**负责人：** ${manager}\n\n`;
  if (deadline) content += `**截止日期：** ${deadline}\n\n`;
  if (newStatus === "有卡点" && breakthrough) {
    content += `---\n\n**⚠️ 卡点说明：** ${breakthrough}\n\n`;
  }

  content += `\n> 来自 TTP2026 AI战略看板`;
  return { title, content };
}

// ─── 通讯录缓存 ──────────────────────────────────────────────

const CONTACTS_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface CacheEntry<T> {
  data: T;
  expireAt: number;
}

const deptListCache = new Map<string, CacheEntry<DingDept[]>>();
const deptMembersCache = new Map<string, CacheEntry<{ list: DingUser[]; hasMore: boolean; nextCursor: number }>>();
const searchCache = new Map<string, CacheEntry<DingUser[]>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expireAt) return entry.data;
  cache.delete(key);
  return null;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, expireAt: Date.now() + CONTACTS_CACHE_TTL });
}

// ─── 通讯录 API 类型 ──────────────────────────────────────────

export interface DingDept {
  dept_id: number;
  name: string;
  parent_id?: number;
  order?: number;
}

export interface DingUser {
  userid: string;
  name: string;
  avatar?: string;
  title?: string;
  mobile?: string;
  dept_id_list?: number[];
}

/**
 * 获取钉钉子部门列表（5 分钟缓存）
 */
export async function getDingTalkDeptList(
  parentId: number = 1
): Promise<DingDept[]> {
  const cacheKey = String(parentId);
  const cached = getCached(deptListCache, cacheKey);
  if (cached) return cached;

  const token = await getDingTalkAccessToken();

  const data = await httpsPost<DingTalkApiResponse<DingDept[]>>(
    `https://oapi.dingtalk.com/topapi/v2/department/listsub?access_token=${token}`,
    { dept_id: parentId }
  );

  if (data.errcode !== 0) {
    throw new Error(`获取部门列表失败: ${data.errmsg} (${data.errcode})`);
  }

  const result = data.result || [];
  setCached(deptListCache, cacheKey, result);
  return result;
}

/**
 * 获取部门成员列表（分页，5 分钟缓存）
 */
export async function getDingTalkDeptMembers(
  deptId: number,
  cursor: number = 0,
  size: number = 50
): Promise<{ list: DingUser[]; hasMore: boolean; nextCursor: number }> {
  const cacheKey = `${deptId}:${cursor}:${size}`;
  const cached = getCached(deptMembersCache, cacheKey);
  if (cached) return cached;

  const token = await getDingTalkAccessToken();

  const data = await httpsPost<DingTalkApiResponse<{
    list: DingUser[];
    has_more: boolean;
    next_cursor: number;
  }>>(
    `https://oapi.dingtalk.com/topapi/v2/user/list?access_token=${token}`,
    {
      dept_id: deptId,
      cursor,
      size,
      order_field: "custom",
      contain_access_limit: false,
      language: "zh_CN",
    }
  );

  if (data.errcode !== 0) {
    throw new Error(`获取部门成员失败: ${data.errmsg} (${data.errcode})`);
  }

  const result = {
    list: data.result?.list || [],
    hasMore: data.result?.has_more || false,
    nextCursor: data.result?.next_cursor || 0,
  };
  setCached(deptMembersCache, cacheKey, result);
  return result;
}

/**
 * 搜索钉钉用户（通过姓名/职务模糊搜索，5 分钟缓存）
 * 注：钉钉无姓名搜索 API，通过根部门成员列表过滤实现
 */
export async function searchDingTalkUsers(keyword: string): Promise<DingUser[]> {
  if (!keyword.trim()) return [];

  // 先尝试从缓存获取根部门成员列表
  const rootCacheKey = "search_root";
  let allUsers = getCached(searchCache, rootCacheKey);

  if (!allUsers) {
    const token = await getDingTalkAccessToken();

    const data = await httpsPost<DingTalkApiResponse<{
      list: DingUser[];
      has_more: boolean;
    }>>(
      `https://oapi.dingtalk.com/topapi/v2/user/list?access_token=${token}`,
      {
        dept_id: 1,
        cursor: 0,
        size: 100,
        order_field: "custom",
        contain_access_limit: false,
        language: "zh_CN",
      }
    );

    if (data.errcode !== 0) {
      throw new Error(`搜索用户失败: ${data.errmsg} (${data.errcode})`);
    }

    allUsers = data.result?.list || [];
    setCached(searchCache, rootCacheKey, allUsers);
  }

  return allUsers.filter(
    (u) => u.name.includes(keyword) || (u.title && u.title.includes(keyword))
  );
}

/**
 * 获取钉钉用户 userId（通过手机号查询）
 */
export async function getDingTalkUserIdByMobile(
  mobile: string
): Promise<string | null> {
  try {
    const token = await getDingTalkAccessToken();

    const data = await httpsPost<DingTalkApiResponse<{ userid: string }>>(
      `https://oapi.dingtalk.com/topapi/v2/user/getbymobile?access_token=${token}`,
      { mobile }
    );

    if (data.errcode !== 0 || !data.result?.userid) return null;
    return data.result.userid;
  } catch {
    return null;
  }
}
