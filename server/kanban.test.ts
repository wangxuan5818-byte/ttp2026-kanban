import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── 测试上下文工厂 ───────────────────────────────────────────
function createCtx(cookies: Record<string, string> = {}): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      cookies,
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

// ─── 登录测试 ─────────────────────────────────────────────────
describe("kanban.login", () => {
  it("should reject invalid credentials", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.kanban.login({ username: "wrong_user", password: "wrong_pass" })
    ).rejects.toThrow();
  });

  it("should reject empty username", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.kanban.login({ username: "", password: "password123" })
    ).rejects.toThrow();
  });
});

// ─── 未认证访问测试 ───────────────────────────────────────────
describe("kanban.me (unauthenticated)", () => {
  it("should return null when no session cookie", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.kanban.me();
    expect(result).toBeNull();
  });
});

// ─── 任务访问控制测试 ─────────────────────────────────────────
describe("tasks (unauthenticated)", () => {
  it("should throw UNAUTHORIZED when listing tasks without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.tasks.list({ committeeId: "qianwei" })
    ).rejects.toThrow();
  });

  it("should throw UNAUTHORIZED when creating task without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.tasks.create({
        committeeId: "qianwei",
        name: "测试任务",
        goal: "测试目标",
        strategy: "测试策略",
      })
    ).rejects.toThrow();
  });

  it("should throw UNAUTHORIZED when deleting task without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.tasks.delete({ id: "non-existent-id" })
    ).rejects.toThrow();
  });
});

// ─── 路由结构测试 ─────────────────────────────────────────────
describe("router structure", () => {
  it("should have kanban router with required procedures", () => {
    expect(appRouter._def.procedures).toHaveProperty("kanban.me");
    expect(appRouter._def.procedures).toHaveProperty("kanban.login");
    expect(appRouter._def.procedures).toHaveProperty("kanban.logout");
  });

  it("should have tasks router with CRUD procedures", () => {
    expect(appRouter._def.procedures).toHaveProperty("tasks.list");
    expect(appRouter._def.procedures).toHaveProperty("tasks.create");
    expect(appRouter._def.procedures).toHaveProperty("tasks.update");
    expect(appRouter._def.procedures).toHaveProperty("tasks.delete");
    expect(appRouter._def.procedures).toHaveProperty("tasks.getAttachments");
    expect(appRouter._def.procedures).toHaveProperty("tasks.uploadAttachment");
    expect(appRouter._def.procedures).toHaveProperty("tasks.calculateScore");
    expect(appRouter._def.procedures).toHaveProperty("tasks.getScore");
    expect(appRouter._def.procedures).toHaveProperty("tasks.getCommitteeScores");
  });

  it("should have auth router", () => {
    expect(appRouter._def.procedures).toHaveProperty("auth.me");
    expect(appRouter._def.procedures).toHaveProperty("auth.logout");
  });

  it("should have kanban user management procedures", () => {
    expect(appRouter._def.procedures).toHaveProperty("kanban.listUsers");
    expect(appRouter._def.procedures).toHaveProperty("kanban.createUser");
    expect(appRouter._def.procedures).toHaveProperty("kanban.updateUser");
    expect(appRouter._def.procedures).toHaveProperty("kanban.resetPassword");
    expect(appRouter._def.procedures).toHaveProperty("kanban.deleteUser");
  });

  it("should have report router", () => {
    expect(appRouter._def.procedures).toHaveProperty("report.weeklyData");
  });

  it("should have notify router", () => {
    expect(appRouter._def.procedures).toHaveProperty("notify.taskStatusChange");
    expect(appRouter._def.procedures).toHaveProperty("notify.getWebhookConfig");
  });
});

// ─── 账号管理权限测试 ─────────────────────────────────────────────
describe("kanban user management (unauthenticated)", () => {
  it("should throw when listing users without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.kanban.listUsers()).rejects.toThrow();
  });

  it("should throw when creating user without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.kanban.createUser({
        username: "testuser",
        password: "password123",
        displayName: "测试用户",
        role: "committee",
        committeeId: "qianwei",
      })
    ).rejects.toThrow();
  });

  it("should throw when deleting user without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.kanban.deleteUser({ id: 999 })).rejects.toThrow();
  });
});

// ─── 周报权限测试 ─────────────────────────────────────────────
describe("report (unauthenticated)", () => {
  it("should throw when fetching weekly data without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.report.weeklyData({ committeeId: "qianwei" })
    ).rejects.toThrow();
  });
});

// ─── 钉钉通知测试 ─────────────────────────────────────────────
describe("notify (unauthenticated)", () => {
  it("should throw when sending notification without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.notify.taskStatusChange({
        taskId: "test-task-id",
        oldStatus: "进行中",
        newStatus: "已完成",
      })
    ).rejects.toThrow();
  });

  it("should throw when getting webhook config without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notify.getWebhookConfig()).rejects.toThrow();
  });
});

// ─── 全局内容管理路由结构测试 ─────────────────────────────────────
describe("config router structure", () => {
  it("should have config.getStrategicConfigs procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("config.getStrategicConfigs");
  });

  it("should have config.upsertStrategicConfig procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("config.upsertStrategicConfig");
  });

  it("should have config.getCommitteeConfigs procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("config.getCommitteeConfigs");
  });

  it("should have config.upsertCommitteeConfig procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("config.upsertCommitteeConfig");
  });

  it("should have config.deleteCommitteeConfig procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("config.deleteCommitteeConfig");
  });
});

// ─── 全局内容管理权限测试（未登录） ───────────────────────────────
describe("config (unauthenticated)", () => {
  it("should throw when getting strategic configs without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.config.getStrategicConfigs()).rejects.toThrow();
  });

  it("should throw when upserting strategic config without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.config.upsertStrategicConfig({ key: "strategicGoal", value: {} })
    ).rejects.toThrow();
  });

  it("should throw when getting committee configs without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.config.getCommitteeConfigs()).rejects.toThrow();
  });

  it("should throw when upserting committee config without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.config.upsertCommitteeConfig({ id: "qianwei", shortName: "前委" })
    ).rejects.toThrow();
  });

  it("should throw when deleting committee config without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.config.deleteCommitteeConfig({ id: "qianwei" })
    ).rejects.toThrow();
  });
});

// ─── tasks.listAll 路由结构测试 ────────────────────────────────────
describe("tasks.listAll route", () => {
  it("should have tasks.listAll procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("tasks.listAll");
  });

  it("should throw when listing all tasks without login", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.tasks.listAll()).rejects.toThrow();
  });
});
