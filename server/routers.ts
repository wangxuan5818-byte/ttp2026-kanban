import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import {
  getDingTalkAccessToken,
  sendDingTalkWorkNotice,
  sendDingTalkWebhookMessage,
  buildTaskStatusNotification,
  getDingTalkDeptList,
  getDingTalkDeptMembers,
  searchDingTalkUsers,
  type DingDept,
  type DingUser,
} from "./dingTalkService";
import { getDb } from "./db";
import {
  getAllKanbanUsers,
  getKanbanUserByUsername,
  getKanbanUserById,
  createKanbanUser,
  updateKanbanUser,
  deleteKanbanUser,
  hashPassword,
  initDefaultKanbanUsers,
} from "./db";
import {
  getTasksByCommittee,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  seedTasksFromStatic,
  getTaskAttachments,
  createTaskAttachment,
  deleteTaskAttachment,
  getLatestScoreRecord,
  getCommitteeScoreRecords,
  upsertScoreRecord,
  getOutcomesByTask,
  getOutcomesByCommittee,
  createOutcomeRecord,
  updateOutcomeRecord,
  deleteOutcomeRecord,
} from "./taskDb";
import {
  getAllStrategicConfigs,
  upsertStrategicConfig,
  getAllCommitteeConfigs,
  getCommitteeConfigById,
  upsertCommitteeConfig,
  deleteCommitteeConfig,
} from "./configDb";

// ─── 看板 JWT 工具 ────────────────────────────────────────────
const KANBAN_COOKIE = "kanban_session";
const KANBAN_JWT_SECRET = new TextEncoder().encode(
  (ENV.cookieSecret || "ttp2026_kanban_secret_key_2026")
);

async function signKanbanToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(KANBAN_JWT_SECRET);
}

async function verifyKanbanToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, KANBAN_JWT_SECRET);
    return payload.sub ? parseInt(payload.sub) : null;
  } catch {
    return null;
  }
}

/** 从请求中解析当前看板用户，未登录抛出 UNAUTHORIZED */
async function requireKanbanUser(ctx: any) {
  const token = ctx.req.cookies?.[KANBAN_COOKIE];
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录" });
  const userId = await verifyKanbanToken(token);
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "会话已过期" });
  const user = await getKanbanUserById(userId);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "用户不存在" });
  return user;
}

/** 验证委员会访问权限：admin 可访问所有，committee 只能访问自己的 */
function checkCommitteeAccess(user: Awaited<ReturnType<typeof requireKanbanUser>>, committeeId: string) {
  if (user.role === "admin") return;
  if (user.committeeId !== committeeId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该委员会数据" });
  }
}
// ─── 积分标准常量（根据图五积分标准） ─────────────────────────────────

/**
 * 项目价值等级判断（基于 outputValue 字段）
 * 十万级：< 100万
 * 百万级：100万 - 1000万
 * 千万级：>= 1000万
 */
function getProjectValueLevel(outputValue?: number | null): "十万" | "百万" | "千万" {
  if (!outputValue) return "十万";
  if (outputValue >= 10_000_000) return "千万";
  if (outputValue >= 1_000_000) return "百万";
  return "十万";
}

/**
 * 当前门位判断（基于 completionRate 和 status）
 * S门：项目启动阶段（完成度 0-30%）
 * A门：项目推进阶段（完成度 30-80%）
 * B门：项目收款阶段（完成度 80-100% 或已完成）
 */
function getGateName(completionRate?: number | null, status?: string): "S门" | "A门" | "B门" {
  if (status === "已完成" || status === "已结束") return "B门";
  const rate = completionRate || 0;
  if (rate >= 80) return "B门";
  if (rate >= 30) return "A门";
  return "S门";
}

/**
 * 根据项目价值等级和门位计算里程碑积分
 * 根据图五积分标准：
 * S门：十万1分, 百万2分, 千万3分
 * A门：十万2分, 百万6分, 千万8分
 * B门：十万3分, 百万8分, 千万10分
 */
const MILESTONE_SCORE_TABLE: Record<string, Record<string, number>> = {
  "S门": { "十万": 1, "百万": 2, "千万": 3 },
  "A门": { "十万": 2, "百万": 6, "千万": 8 },
  "B门": { "十万": 3, "百万": 8, "千万": 10 },
};

/**
 * 月度积分表（项目进行中每月预期分）
 * 十万级：0.5分/月
 * 百万级：1.5分/月
 * 千万级：1.5分/月
 */
const MONTHLY_SCORE_TABLE: Record<string, number> = {
  "十万": 0.5,
  "百万": 1.5,
  "千万": 1.5,
};

/**
 * 辅导员积分表
 * 未参与：0分
 * 指导成功：十万1分, 百万3分, 千万5分
 * 主动辅导：十万2分, 百万6分, 千万8分
 * 与成功案例：十万5分, 百万8分, 千万10分
 */
const MENTOR_SCORE_TABLE: Record<string, Record<string, number>> = {
  "未参与": { "十万": 0, "百万": 0, "千万": 0 },
  "指导成功": { "十万": 1, "百万": 3, "千万": 5 },
  "主动辅导": { "十万": 2, "百万": 6, "千万": 8 },
  "与成功案例": { "十万": 5, "百万": 8, "千万": 10 },
};

// ─── AI 积分核算 ───────────────────────────────────────────────
async function calculateScoreWithAI(
  task: any,
  attachmentCount: number,
  options?: { mentorLevel?: string; mentorName?: string }
) {
  // ─── 根据图五积分标准计算基础积分 ───
  const projectValueLevel = getProjectValueLevel(task.outputValue);
  const gateName = getGateName(task.completionRate, task.status);
  const milestoneScore = MILESTONE_SCORE_TABLE[gateName]?.[projectValueLevel] ?? 0;
  const monthlyScore = MONTHLY_SCORE_TABLE[projectValueLevel] ?? 0.5;
  const mentorLevel = options?.mentorLevel || "未参与";
  const mentorScore = MENTOR_SCORE_TABLE[mentorLevel]?.[projectValueLevel] ?? 0;
  const mentorName = options?.mentorName || "";

  // ─── AI 辅助评估（质量维度） ───
  const prompt = `你是一个企业战略项目评估专家。请根据以下项目信息，评估项目的各维度得分。

项目信息：
- 项目名称：${task.name}
- 委员会：${task.committeeId}
- 目标：${task.goal}
- 策略：${task.strategy}
- 当前状态：${task.status}
- 完成度：${task.completionRate || 0}%
- 项目价值等级：${projectValueLevel}级
- 当前门位：${gateName}
- 里程碑：${task.milestone || "未设置"}
- 当前成果：${task.result || "暂无"}
- 突破点：${task.breakthrough || "暂无"}
- 投入工时（人天）：${task.inputManDays || "未填写"}
- 产出价值（元）：${task.outputValue || "未填写"}
- 产出附件数量：${attachmentCount}
- 负责人：${task.manager || "未指定"}
- 协作成员数：${(task.contributors || []).length}
- 截止日期：${task.deadline || "未设置"}

根据图五积分标准，已算出基础积分：
- 项目价值等级：${projectValueLevel}级
- 当前门位：${gateName}（完成度${task.completionRate || 0}%）
- 里程碑积分：${milestoneScore}分
- 月度预期积分：${monthlyScore}分/月
- 辅导员积分：${mentorScore}分（${mentorLevel}）

请对以下质量维度评分（每项0-100分），并给出综合分析：
1. 完成度积分（权吆40%）：基于完成度百分比和实际成果
2. 产出质量积分（权吆30%）：基于成果描述和附件数量
3. 时效积分（权吆20%）：基于是否按时推进
4. 协作积分（权吆10%）：基于团队协作情况

请以JSON格式返回：
{
  "completionScore": 数字,
  "qualityScore": 数字,
  "timelinessScore": 数字,
  "collaborationScore": 数字,
  "totalScore": 数字（四项加权平均）,
  "roi": 数字或null,
  "bonusCoeff": 数字（0-2）,
  "estimatedBonus": 数字,
  "aiSummary": "不超过120字的分析摘要，包含项目价值等级、门位、里程碑积分和建议"
}`;

  let aiResult: any = null;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: "你是企业战略项目评估专家，只返回JSON格式数据。" },
        { role: "user" as const, content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "score_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              completionScore: { type: "number" },
              qualityScore: { type: "number" },
              timelinessScore: { type: "number" },
              collaborationScore: { type: "number" },
              totalScore: { type: "number" },
              roi: { type: ["number", "null"] },
              bonusCoeff: { type: "number" },
              estimatedBonus: { type: "number" },
              aiSummary: { type: "string" },
            },
            required: ["completionScore", "qualityScore", "timelinessScore", "collaborationScore", "totalScore", "roi", "bonusCoeff", "estimatedBonus", "aiSummary"],
            additionalProperties: false,
          },
        },
      },
    } as any);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    aiResult = JSON.parse(contentStr);
  } catch (err) {
    // Fallback 本地计算
    const completion = task.completionRate || 0;
    const completionScore = completion;
    const qualityScore = task.result ? Math.min(completion + 10, 100) : completion * 0.8;
    const timelinessScore = (task.status === "已完成" || task.status === "已结束") ? 90 : task.status === "进行中" ? 70 : task.status === "有卡点" ? 30 : 50;
    const collaborationScore = Math.min((task.contributors || []).length * 15 + 40, 100);
    const totalScore = completionScore * 0.4 + qualityScore * 0.3 + timelinessScore * 0.2 + collaborationScore * 0.1;
    const roi = task.inputManDays && task.outputValue ? task.outputValue / (task.inputManDays * 1000) : null;
    const bonusCoeff = totalScore >= 90 ? 1.5 : totalScore >= 70 ? 1.0 : totalScore >= 50 ? 0.7 : 0.3;
    aiResult = {
      completionScore, qualityScore, timelinessScore, collaborationScore, totalScore,
      roi, bonusCoeff, estimatedBonus: bonusCoeff * 5000,
      aiSummary: `项目价值${projectValueLevel}级，处于${gateName}阶段。完成度${completion}%，里程碑积分${milestoneScore}分，月度预期${monthlyScore}分/月。`,
    };
  }

  // 合并图五积分标准字段
  return {
    ...aiResult,
    projectValueLevel,
    gateName,
    milestoneScore,
    monthlyScore,
    mentorScore,
    mentorName,
    // 总积分 = AI综合分 + 里程碑积分 + 辅导员积分
    totalScore: (aiResult.totalScore || 0) + milestoneScore + mentorScore,
  };
}

// ─── 路由定义 ─────────────────────────────────────────
export const appRouter = router({
  // ─── 配置管理路由（管理员专属）─────────────────────────────────
  config: router({
    /** 获取所有战略配置 */
    getStrategicConfigs: publicProcedure.query(async ({ ctx }) => {
      await requireKanbanUser(ctx);
      return getAllStrategicConfigs();
    }),

    /** 更新战略配置 */
    upsertStrategicConfig: publicProcedure
      .input(z.object({
        key: z.string().min(1),
        value: z.any(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        await upsertStrategicConfig(input.key, input.value, me.id);
        return { success: true };
      }),

    /** 获取所有委员会配置 */
    getCommitteeConfigs: publicProcedure.query(async ({ ctx }) => {
      await requireKanbanUser(ctx);
      return getAllCommitteeConfigs();
    }),

    /** 获取单个委员会配置 */
    getCommitteeConfig: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        return getCommitteeConfigById(input.id);
      }),

    /** 创建或更新委员会配置 */
    upsertCommitteeConfig: publicProcedure
      .input(z.object({
        id: z.string().min(1).max(64),
        shortName: z.string().min(1).max(50),
        fullName: z.string().min(1).max(200),
        color: z.string().min(1).max(20),
        icon: z.string().min(1).max(20),
        chairman: z.string().min(1).max(100),
        director: z.string().max(100).optional().nullable(),
        members: z.array(z.string()).optional().nullable(),
        responsibility: z.array(z.string()).optional().nullable(),
        annualGoal: z.string().optional().nullable(),
        conditions: z.array(z.string()).optional().nullable(),
        rewardPool: z.string().optional().nullable(),
        milestones: z.any().optional().nullable(),
        status: z.enum(["active", "paused", "terminated"]).optional(),
        dingTalkWebhook: z.string().max(500).optional().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        await upsertCommitteeConfig(input, me.id);
        return { success: true };
      }),

    /** 删除委员会配置 */
    deleteCommitteeConfig: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        await deleteCommitteeConfig(input.id);
        return { success: true };
      }),
  }),

  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── 看板认证 ───────────────────────────────────────────────
  kanban: router({
    me: publicProcedure.query(async ({ ctx }) => {
      const token = ctx.req.cookies?.[KANBAN_COOKIE];
      if (!token) return null;
      const userId = await verifyKanbanToken(token);
      if (!userId) return null;
      const user = await getKanbanUserById(userId);
      if (!user) return null;
      return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, committeeId: user.committeeId };
    }),

    login: publicProcedure
      .input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        await initDefaultKanbanUsers();
        const user = await getKanbanUserByUsername(input.username);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
        if (user.passwordHash !== hashPassword(input.password)) throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
        const token = await signKanbanToken(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(KANBAN_COOKIE, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, committeeId: user.committeeId };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(KANBAN_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    listUsers: publicProcedure.query(async ({ ctx }) => {
      const me = await requireKanbanUser(ctx);
      if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      const users = await getAllKanbanUsers();
      return users.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, committeeId: u.committeeId }));
    }),

    createUser: publicProcedure
      .input(z.object({
        username: z.string().min(1).max(64),
        password: z.string().min(6).max(128),
        displayName: z.string().min(1).max(100),
        role: z.enum(["admin", "committee"]),
        committeeId: z.string().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
        // 检查用户名是否已存在
        const existing = await getKanbanUserByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
        await createKanbanUser({ username: input.username, passwordHash: hashPassword(input.password), displayName: input.displayName, role: input.role, committeeId: input.committeeId });
        return { success: true };
      }),

    updateUser: publicProcedure
      .input(z.object({
        id: z.number(),
        displayName: z.string().min(1).max(100).optional(),
        role: z.enum(["admin", "committee"]).optional(),
        committeeId: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
        const { id, ...data } = input;
        await updateKanbanUser(id, data as any);
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(6).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
        await updateKanbanUser(input.id, { passwordHash: hashPassword(input.newPassword) });
        return { success: true };
      }),

    deleteUser: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
        if (me.id === input.id) throw new TRPCError({ code: "BAD_REQUEST", message: "不能删除自己的账号" });
        await deleteKanbanUser(input.id);
        return { success: true };
      }),
  }),

  // ─── 周报导出 ─────────────────────────────────────────────
  report: router({
    /** 生成周报数据（前端用于生成 PDF） */
    weeklyData: publicProcedure
      .input(z.object({ committeeId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        await seedTasksFromStatic();
        const tasks = await getTasksByCommittee(input.committeeId);
        const scores = await getCommitteeScoreRecords(input.committeeId);

        // 按状态分组
        const byStatus = {
          "进行中": tasks.filter(t => t.status === "进行中"),
          "已完成": tasks.filter(t => t.status === "已完成" || t.status === "已结束"),
          "已结束": tasks.filter(t => t.status === "已结束" || t.status === "已完成"),
          "有卡点": tasks.filter(t => t.status === "有卡点"),
          "待启动": tasks.filter(t => t.status === "待启动"),
        };

        // 积分汇总
        const totalScore = scores.reduce((sum, s) => sum + (s.totalScore || 0), 0);
        const avgScore = scores.length > 0 ? totalScore / scores.length : 0;
        const totalBonus = scores.reduce((sum, s) => sum + (s.estimatedBonus || 0), 0);

        // 周期（当前周）
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStr = `${weekStart.getMonth()+1}月${weekStart.getDate()}日 - ${weekEnd.getMonth()+1}月${weekEnd.getDate()}日`;

        return {
          committeeId: input.committeeId,
          weekStr,
          reportDate: now.toLocaleDateString("zh-CN"),
          tasks,
          byStatus,
          scores,
          summary: {
            total: tasks.length,
            inProgress: byStatus["进行中"].length,
            completed: byStatus["已完成"].length,
            blocked: byStatus["有卡点"].length,
            pending: byStatus["待启动"].length,
            avgCompletion: tasks.length > 0
              ? Math.round(tasks.reduce((s, t) => s + (t.completionRate || 0), 0) / tasks.length)
              : 0,
            totalScore: Math.round(totalScore),
            avgScore: Math.round(avgScore),
            totalBonus: Math.round(totalBonus),
          },
        };
      }),
  }),

  // ─── 钉钉通知 ─────────────────────────────────────────────
  notify: router({
    /** 钉钉机器人推送任务状态变更通知（支持 Webhook + 工作通知） */
    taskStatusChange: publicProcedure
      .input(z.object({
        taskId: z.string(),
        oldStatus: z.string(),
        newStatus: z.string(),
        webhookUrl: z.string().url().optional(),
        /** 钉钉 userId 列表（用于工作通知，需要 AgentId 权限） */
        dingUserIds: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);

        // 只在状态变为"有卡点"或"已结束"时发送通知
        if (input.newStatus !== "有卡点" && input.newStatus !== "已完成" && input.newStatus !== "已结束") {
          return { sent: false, reason: "状态变更不需要通知" };
        }

        // 动态获取委员会名称
        const { committees: staticComms } = await import("../client/src/data/kanbanData.js");
        const committee = staticComms.find((c: any) => c.id === task.committeeId);
        const committeeShortName = committee?.shortName || task.committeeId;

        const { title, content } = buildTaskStatusNotification({
          taskName: task.name,
          committeeShortName,
          oldStatus: input.oldStatus,
          newStatus: input.newStatus,
          manager: task.manager || undefined,
          deadline: task.deadline || undefined,
          breakthrough: task.breakthrough || undefined,
        });

        const results: { channel: string; success: boolean; error?: string }[] = [];

        // 1. 通过 Webhook 发送群消息
        if (input.webhookUrl) {
          const r = await sendDingTalkWebhookMessage(input.webhookUrl, title, content);
          results.push({ channel: "webhook", ...r });
        }

        // 2. 通过工作通知发送给指定用户
        if (input.dingUserIds && input.dingUserIds.length > 0 && ENV.dingTalkAgentId) {
          const r = await sendDingTalkWorkNotice(input.dingUserIds, title, content);
          results.push({ channel: "workNotice", ...r });
        }

        if (results.length === 0) {
          return { sent: false, reason: "未配置钉钉 Webhook 或用户 ID，请先在通知配置中设置" };
        }

        const anySuccess = results.some(r => r.success);
        return {
          sent: anySuccess,
          message: anySuccess ? `通知已发送（${results.filter(r => r.success).map(r => r.channel).join("、")}）` : undefined,
          reason: !anySuccess ? results.map(r => r.error).join("；") : undefined,
          results,
        };
      }),

    /** 测试获取钉钉 access_token（管理员专用） */
    testConnection: publicProcedure.mutation(async ({ ctx }) => {
      const me = await requireKanbanUser(ctx);
      if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      try {
        const token = await getDingTalkAccessToken();
        return {
          success: true,
          message: "钉钉 access_token 获取成功",
          tokenPreview: token.slice(0, 8) + "...",
          agentId: ENV.dingTalkAgentId,
          clientId: ENV.dingTalkClientId,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }),

    /** 向指定钉钉用户发送工作通知（管理员专用） */
    sendWorkNotice: publicProcedure
      .input(z.object({
        userIds: z.array(z.string().min(1)).min(1),
        title: z.string().min(1).max(100),
        content: z.string().min(1).max(2000),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
        const result = await sendDingTalkWorkNotice(input.userIds, input.title, input.content);
        return result;
      }),

    /** 获取当前钉钉 Webhook 配置（管理员可设置） */
    getWebhookConfig: publicProcedure.query(async ({ ctx }) => {
      const me = await requireKanbanUser(ctx);
      if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      const webhookUrl = process.env.DINGTALK_WEBHOOK_URL || "";
      return {
        webhookUrl,
        configured: !!webhookUrl,
        agentId: ENV.dingTalkAgentId,
        clientId: ENV.dingTalkClientId,
        appId: ENV.dingTalkAppId,
        hasCredentials: !!(ENV.dingTalkClientId && ENV.dingTalkClientSecret),
      };
    }),
  }),

  // ─── 钉钉通讯录 ─────────────────────────────────────────────
  dingtalk: router({
    /** 搜索钉钉通讯录成员（支持姓名模糊搜索） */
    searchContacts: publicProcedure
      .input(z.object({ query: z.string().min(1).max(50) }))
      .query(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        // 从静态委员会数据中搜索成员（实际可接入钉钉 API）
        const { committees: staticComms } = await import("../client/src/data/kanbanData");
        const query = input.query.toLowerCase();
        const allMembers = new Map<string, { name: string; deptName: string }>();
        for (const c of staticComms) {
          for (const m of c.members) {
            if (!allMembers.has(m)) {
              allMembers.set(m, { name: m, deptName: c.shortName });
            }
          }
          if (c.chairman && !allMembers.has(c.chairman)) {
            allMembers.set(c.chairman, { name: c.chairman, deptName: c.shortName + "主席" });
          }
          if (c.director && !allMembers.has(c.director)) {
            allMembers.set(c.director, { name: c.director, deptName: c.shortName + "主任" });
          }
        }
        const results = Array.from(allMembers.values())
          .filter(m => m.name.toLowerCase().includes(query))
          .slice(0, 20);
        return results;
      }),
  }),

  // ─── 任务管理 ───────────────────────────────────────────────
  tasks: router({
    /** 获取委员会任务列表（DB 数据） */
    list: publicProcedure
      .input(z.object({ committeeId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        await seedTasksFromStatic();
        return await getTasksByCommittee(input.committeeId);
      }),

    /** 获取所有任务（管理员） */
    listAll: publicProcedure.query(async ({ ctx }) => {
      const me = await requireKanbanUser(ctx);
      if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      await seedTasksFromStatic();
      return await getAllTasks();
    }),

    /** 获取单个任务详情 */
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.id);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);
        return task;
      }),

    /** 创建任务 */
    create: publicProcedure
      .input(z.object({
        committeeId: z.string(),
        name: z.string().min(1).max(200),
        goal: z.string(),
        strategy: z.string(),
        actions: z.array(z.string()).default([]),
        milestone: z.string().optional(),
        result: z.string().optional(),
        breakthrough: z.string().optional(),
        manager: z.string().optional(),
        managerUserId: z.string().optional(),
        contributors: z.array(z.string()).default([]),
        contributorUserIds: z.array(z.string()).default([]),
        dingDeptIds: z.array(z.string()).default([]),
        deadline: z.string().optional(),
        status: z.enum(["进行中", "已完成", "待启动", "有卡点", "已结束"]).default("待启动"),
        rewardPool: z.string().optional(),
        inputManDays: z.number().optional(),
        outputValue: z.number().optional(),
        completionRate: z.number().min(0).max(100).default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        const task = await createTask({ ...input, createdBy: me.id });
        return task;
      }),

    /** 更新任务 */
    update: publicProcedure
      .input(z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        goal: z.string().optional(),
        strategy: z.string().optional(),
        actions: z.array(z.string()).optional(),
        milestone: z.string().optional(),
        result: z.string().optional(),
        breakthrough: z.string().optional(),
        manager: z.string().optional(),
        managerUserId: z.string().optional(),
        contributors: z.array(z.string()).optional(),
        contributorUserIds: z.array(z.string()).optional(),
        dingDeptIds: z.array(z.string()).optional(),
        deadline: z.string().optional(),
        status: z.enum(["进行中", "已完成", "待启动", "有卡点", "已结束"]).optional(),
        rewardPool: z.string().optional(),
        inputManDays: z.number().optional(),
        outputValue: z.number().optional(),
        completionRate: z.number().min(0).max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const existing = await getTaskById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, existing.committeeId);
        const { id, ...data } = input;
        const updated = await updateTask(id, data);
        return updated;
      }),

    /** 删除任务 */
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const existing = await getTaskById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, existing.committeeId);
        await deleteTask(input.id);
        return { success: true };
      }),

    /** 获取任务附件 */
    getAttachments: publicProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);
        return await getTaskAttachments(input.taskId);
      }),

    /** 上传附件（Base64 编码） */
    uploadAttachment: publicProcedure
      .input(z.object({
        taskId: z.string(),
        committeeId: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string(), // Base64 编码的文件内容
        fileSize: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);

        // 解码 Base64 并上传到 S3
        const buffer = Buffer.from(input.base64Data, "base64");
        const ext = input.filename.split(".").pop() || "bin";
        const fileKey = `tasks/${input.committeeId}/${input.taskId}/${nanoid(8)}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        const attachment = await createTaskAttachment({
          taskId: input.taskId,
          committeeId: input.committeeId,
          fileKey,
          url,
          filename: input.filename,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          uploadedBy: me.id,
        });
        return attachment;
      }),

    /** 删除附件 */
    deleteAttachment: publicProcedure
      .input(z.object({ attachmentId: z.number(), taskId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);
        await deleteTaskAttachment(input.attachmentId);
        return { success: true };
      }),

    /** AI 核算积分（调用 LLM） */
        calculateScore: publicProcedure
      .input(z.object({
        taskId: z.string(),
        mentorLevel: z.string().optional(), // 辅导员等级：未参与/指导成功/主动辅导/与成功案例
        mentorName: z.string().optional(), // 辅导员姓名
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);
        const attachments = await getTaskAttachments(input.taskId);
        const scoreData = await calculateScoreWithAI(task, attachments.length, {
          mentorLevel: input.mentorLevel,
          mentorName: input.mentorName,
        });
        await upsertScoreRecord({
          taskId: task.id,
          committeeId: task.committeeId,
          ...scoreData,
        });
        // 更新任务积分字段
        await updateTask(task.id, { score: scoreData.totalScore });
        return scoreData;
      }),

    /** 获取任务积分记录 */
    getScore: publicProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);
        return (await getLatestScoreRecord(input.taskId)) ?? null;
      }),

    /** 获取委员会积分汇总 */
    getCommitteeScores: publicProcedure
      .input(z.object({ committeeId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        return await getCommitteeScoreRecords(input.committeeId);
      }),
    /** 获取本周新增/完成任务统计（管理员） */
    weeklyStats: publicProcedure.query(async ({ ctx }) => {
      const me = await requireKanbanUser(ctx);
      if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      // 本周一 00:00:00
      const now = new Date();
      const weekStart = new Date(now);
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      const allTasks = await getAllTasks();
      const result: Record<string, { newCount: number; doneCount: number }> = {};
      for (const task of allTasks) {
        const cid = task.committeeId;
        if (!result[cid]) result[cid] = { newCount: 0, doneCount: 0 };
        if (task.createdAt && new Date(task.createdAt) >= weekStart) result[cid].newCount++;
        if ((task.status === "已完成" || task.status === "已结束") && task.updatedAt && new Date(task.updatedAt) >= weekStart) result[cid].doneCount++;
      }
      return result;
    }),
    /** 近4周每周完成任务数趋势（过去4周） */
    weeklyTrend: publicProcedure.query(async ({ ctx }) => {
      const me = await requireKanbanUser(ctx);
      if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      const allTasks = await getAllTasks();
      const now = new Date();
      const getWeekStart = (weeksAgo: number) => {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff - weeksAgo * 7);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const weekLabels = ["4周前", "3周前", "2周前", "本周"];
      const weeks = [3, 2, 1, 0].map((weeksAgo, idx) => ({
        label: weekLabels[idx],
        start: getWeekStart(weeksAgo),
        end: weeksAgo === 0 ? new Date(now.getTime() + 86400000) : getWeekStart(weeksAgo - 1),
      }));
      return weeks.map(week => ({
        label: week.label,
        done: allTasks.filter(t =>
          (t.status === "已完成" || t.status === "已结束") &&
          t.updatedAt &&
          new Date(t.updatedAt) >= week.start &&
          new Date(t.updatedAt) < week.end
        ).length,
      }));
    }),
    /** 从 JSON 批量导入任务 */
    importFromJson: publicProcedure
      .input(z.object({
        committeeId: z.string(),
        tasks: z.array(z.object({
          name: z.string().min(1).max(200),
          goal: z.string().optional().default(""),
          strategy: z.string().optional().default(""),
          actions: z.array(z.string()).optional().default([]),
          milestone: z.string().optional(),
          result: z.string().optional(),
          breakthrough: z.string().optional(),
          manager: z.string().optional(),
          contributors: z.array(z.string()).optional().default([]),
          deadline: z.string().optional(),
          status: z.enum(["进行中", "已完成", "待启动", "有卡点", "已结束"]).optional().default("待启动"),
          rewardPool: z.string().optional(),
          completionRate: z.number().min(0).max(100).optional().default(0),
        }))
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        const created = [];
        for (const t of input.tasks) {
          const task = await createTask({
            committeeId: input.committeeId,
            name: t.name,
            goal: t.goal || "",
            strategy: t.strategy || "",
            actions: t.actions || [],
            milestone: t.milestone,
            result: t.result,
            breakthrough: t.breakthrough,
            manager: t.manager,
            contributors: t.contributors || [],
            deadline: t.deadline,
            status: t.status || "待启动",
            rewardPool: t.rewardPool,
            completionRate: t.completionRate || 0,
            createdBy: me.id,
          });
          created.push(task);
        }
        return { count: created.length, tasks: created };
      }),
    /** 图片识别导入任务（AI OCR） */
    recognizeImage: publicProcedure
      .input(z.object({
        committeeId: z.string(),
        imageUrl: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        const response = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: `你是一个任务信息提取助手。用户上传了一张任务相关截图（可能是周报、任务卡、表格等）。请从图片中提取任务信息，返回一个 JSON 对象。\n\n返回格式：\n{\n  "name": "任务名称",\n  "goal": "任务目标",\n  "strategy": "策略",\n  "actions": ["行动计划条目1", "行动计划条目2"],\n  "milestone": "里程碑",\n  "result": "当前进展/结果",\n  "breakthrough": "突破方向",\n  "manager": "责任人",\n  "contributors": ["协作人1"],\n  "deadline": "YYYY-MM-DD",\n  "status": "待启动",\n  "completionRate": 0\n}\n\n如果图片中没有某个字段的信息，就留空字符串或空数组。status 只能是：进行中/已完成/待启动/有卡点/已结束。只返回 JSON，不要包含其他文字。`,
            },
            {
              role: "user" as const,
              content: [
                { type: "text" as const, text: "请从这张截图中提取任务信息：" },
                { type: "image_url" as const, image_url: { url: input.imageUrl, detail: "high" as const } },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "task_info",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  goal: { type: "string" },
                  strategy: { type: "string" },
                  actions: { type: "array", items: { type: "string" } },
                  milestone: { type: "string" },
                  result: { type: "string" },
                  breakthrough: { type: "string" },
                  manager: { type: "string" },
                  contributors: { type: "array", items: { type: "string" } },
                  deadline: { type: "string" },
                  status: { type: "string" },
                  completionRate: { type: "number" },
                },
                required: ["name", "goal", "strategy", "actions", "milestone", "result", "breakthrough", "manager", "contributors", "deadline", "status", "completionRate"],
                additionalProperties: false,
              },
            },
          },
        } as any);
        const content = response.choices[0]?.message?.content;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 识别失败" });
        try {
          return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回格式错误" });
        }
      }),
    /** AI 项目诊断 */
    diagnose: publicProcedure
      .input(z.object({
        committeeId: z.string(),
        taskId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const { tasks: tasksTable } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库连接失败" });
        const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, input.taskId));
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        if (!ENV.forgeApiKey) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 诊断功能未配置，请在 .env 中设置 BUILT_IN_FORGE_API_KEY" });
        }
        const actionsText = (task.actions as string[] || []).map((a, i) => `${i+1}. ${a}`).join("\n") || "未填写";
        const prompt = `你是一个专业的项目管理顾问，擅长 OKR 和敏捷项目管理。请对以下任务进行深度诊断，从目标明确性、路径可行性、里程碑合理性、行动计划完整性、结果导向性五个维度给出诊断意见。\n\n任务信息：\n- 名称：${task.name}\n- 目标：${task.goal || "未填写"}\n- 策略：${task.strategy || "未填写"}\n- 行动计划：\n${actionsText}\n- 里程碑：${task.milestone || "未填写"}\n- 当前进展/结果：${task.result || "未填写"}\n- 突破方向：${task.breakthrough || "未填写"}\n- 责任人：${task.manager || "未指定"}\n- 截止日期：${task.deadline || "未设定"}\n- 当前状态：${task.status}\n- 完成度：${task.completionRate ?? 0}%\n\n请用中文回复，格式如下：\n## 诊断总结\n（一句话总结该任务的整体健康状态）\n\n## 五维度评估\n| 维度 | 评分 | 评价 |\n|------|------|------|\n| 目标明确性 | X/10 | ... |\n| 路径可行性 | X/10 | ... |\n| 里程碑合理性 | X/10 | ... |\n| 行动计划完整性 | X/10 | ... |\n| 结果导向性 | X/10 | ... |\n\n## 主要风险\n（列出 2-3 个主要风险）\n\n## 改进建议\n（具体可操作的 3-5 条建议）`;
        const response = await invokeLLM({
          messages: [
            { role: "system" as const, content: "你是一个专业的项目管理顾问，擅长 OKR 和敏捷项目管理。" },
            { role: "user" as const, content: prompt },
          ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 诊断失败" });
        return { diagnosis: typeof content === "string" ? content : JSON.stringify(content) };
      }),
    /** 批量创建任务（粘贴多行文本） */
    batchCreate: publicProcedure
      .input(z.object({
        committeeId: z.string(),
        names: z.array(z.string().min(1).max(200)),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        const created = [];
        for (const name of input.names) {
          const task = await createTask({
            committeeId: input.committeeId,
            name: name.trim(),
            goal: "",
            strategy: "",
            status: "待启动",
            createdBy: me.id,
          });
          created.push(task);
        }
        return created;
      }),
    /** 批量更新任务状态 */
    batchStatusUpdate: publicProcedure
      .input(z.object({
        ids: z.array(z.string()),
        status: z.enum(["待启动", "进行中", "有卡点", "已结束", "已完成"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        let updated = 0;
        for (const id of input.ids) {
          try {
            await updateTask(id, { status: input.status });
            updated++;
          } catch (_) {}
        }
        return { updated };
      }),
    /** 批量删除任务 */
    batchDelete: publicProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        let deleted = 0;
        for (const id of input.ids) {
          try {
            await deleteTask(id);
            deleted++;
          } catch (_) {}
        }
        return { deleted };
      }),
  }),

  // ─── 钉钉通讯录路由 ────────────────────────────────────────
  contacts: router({
    /** 获取子部门列表 */
    getDepts: publicProcedure
      .input(z.object({ parentId: z.number().default(1) }))
      .query(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        try {
          const depts = await getDingTalkDeptList(input.parentId);
          return { success: true, depts };
        } catch (err: any) {
          return { success: false, depts: [] as DingDept[], error: err.message };
        }
      }),

    /** 获取部门成员列表 */
    getDeptMembers: publicProcedure
      .input(z.object({
        deptId: z.number(),
        cursor: z.number().default(0),
        size: z.number().default(50),
      }))
      .query(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        try {
          const result = await getDingTalkDeptMembers(input.deptId, input.cursor, input.size);
          return { success: true, ...result };
        } catch (err: any) {
          return { success: false, list: [] as DingUser[], hasMore: false, nextCursor: 0, error: err.message };
        }
      }),

    /** 搜索用户 */
    searchUsers: publicProcedure
      .input(z.object({ keyword: z.string().min(1).max(50) }))
      .query(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        try {
          const users = await searchDingTalkUsers(input.keyword);
          return { success: true, users };
        } catch (err: any) {
          return { success: false, users: [] as DingUser[], error: err.message };
        }
      }),
  }),

  // ─── 效益核算路由 ─────────────────────────────────────────────
  outcomes: router({
    /** 获取任务的所有效益记录 */
    listByTask: publicProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        const task = await getTaskById(input.taskId);
        if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
        checkCommitteeAccess(me, task.committeeId);
        return await getOutcomesByTask(input.taskId);
      }),

    /** 获取委员会所有效益记录（汇总用） */
    listByCommittee: publicProcedure
      .input(z.object({ committeeId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        return await getOutcomesByCommittee(input.committeeId);
      }),

    /** 新增效益记录 */
    create: publicProcedure
      .input(z.object({
        taskId: z.string(),
        committeeId: z.string(),
        type: z.enum(["提效", "降本", "增收"]),
        scenario: z.string().min(1).max(200),
        beforeValue: z.number(),
        afterValue: z.number(),
        unit: z.string().min(1).max(50),
        frequency: z.number().default(1),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        return await createOutcomeRecord({ ...input, createdBy: me.id });
      }),

    /** 更新效益记录 */
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        type: z.enum(["提效", "降本", "增收"]).optional(),
        scenario: z.string().min(1).max(200).optional(),
        beforeValue: z.number().optional(),
        afterValue: z.number().optional(),
        unit: z.string().min(1).max(50).optional(),
        frequency: z.number().optional(),
        remark: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        const { id, ...data } = input;
        return await updateOutcomeRecord(id, data);
      }),

    /** 删除效益记录 */
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await requireKanbanUser(ctx);
        await deleteOutcomeRecord(input.id);
        return { success: true };
      }),

    /** 全局效益汇总（管理员专用） */
    globalSummary: publicProcedure
      .query(async ({ ctx }) => {
        const me = await requireKanbanUser(ctx);
        if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可查看全局效益" });
        // 获取所有任务
        const allTasks = await getAllTasks();
        // 按部门汇总效益
        const deptSummary: Record<string, { 提效: number; 降本: number; 增收: number; count: number }> = {};
        for (const task of allTasks) {
          const outcomes = await getOutcomesByTask(task.id);
          if (!deptSummary[task.committeeId]) {
            deptSummary[task.committeeId] = { 提效: 0, 降本: 0, 增收: 0, count: 0 };
          }
          for (const o of outcomes) {
            deptSummary[task.committeeId].count++;
            const diff = o.beforeValue - o.afterValue;
            const freq = o.frequency ?? 1;
            if (o.type === "提效") deptSummary[task.committeeId]["提效"] += diff * freq * 12;
            else if (o.type === "降本") deptSummary[task.committeeId]["降本"] += diff * freq * 12;
            else deptSummary[task.committeeId]["增收"] += (o.afterValue - o.beforeValue) * freq;
          }
        }
        return deptSummary;
      }),

    /** 部门效益汇总（包含所有任务的效益记录） */
    deptSummary: publicProcedure
      .input(z.object({ committeeId: z.string() }))
      .query(async ({ input, ctx }) => {
        const me = await requireKanbanUser(ctx);
        checkCommitteeAccess(me, input.committeeId);
        const outcomes = await getOutcomesByCommittee(input.committeeId);
        const summary = { 提效: 0, 降本: 0, 增收: 0, count: outcomes.length };
        for (const o of outcomes) {
          const diff = o.beforeValue - o.afterValue;
          const freq = o.frequency ?? 1;
          if (o.type === "提效") summary["提效"] += diff * freq * 12;
          else if (o.type === "降本") summary["降本"] += diff * freq * 12;
          else summary["增收"] += (o.afterValue - o.beforeValue) * freq;
        }
        return { ...summary, outcomes };
      }),
  }),
});

export type AppRouter = typeof appRouter;
