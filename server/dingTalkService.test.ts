/**
 * 钉钉服务测试
 * 验证：buildTaskStatusNotification 构建、环境变量读取
 * 注意：access_token 获取需要真实网络，在 CI 中跳过
 */

import { describe, it, expect } from "vitest";
import { buildTaskStatusNotification } from "./dingTalkService";
import { ENV } from "./_core/env";

describe("buildTaskStatusNotification", () => {
  it("应生成有卡点通知内容", () => {
    const { title, content } = buildTaskStatusNotification({
      taskName: "AI 战略落地",
      committeeShortName: "技术委",
      oldStatus: "进行中",
      newStatus: "有卡点",
      manager: "张三",
      breakthrough: "资源不足",
    });

    expect(title).toContain("AI 战略落地");
    // 有卡点使用 🔴 emoji
    expect(title).toContain("🔴");
    expect(content).toContain("有卡点");
    expect(content).toContain("张三");
    expect(content).toContain("资源不足");
  });

  it("应生成已结束通知内容", () => {
    const { title, content } = buildTaskStatusNotification({
      taskName: "数字化转型",
      committeeShortName: "战略委",
      oldStatus: "进行中",
      newStatus: "已结束",
      manager: "李四",
      deadline: "2026-06-30",
    });

    expect(title).toContain("数字化转型");
    expect(title).toContain("✅");
    expect(content).toContain("已结束");
    expect(content).toContain("李四");
    expect(content).toContain("2026-06-30");
  });

  it("应包含委员会名称", () => {
    const { content } = buildTaskStatusNotification({
      taskName: "测试任务",
      committeeShortName: "测试委",
      oldStatus: "待启动",
      newStatus: "有卡点",
    });

    expect(content).toContain("测试委");
  });
});

describe("ENV 钉钉配置", () => {
  it("应能读取钉钉环境变量（不为空则验证格式）", () => {
    // 在测试环境中，凭证可能通过 .env 注入
    // 只验证字段存在，不强制要求非空（CI 环境可能未配置）
    expect(typeof ENV.dingTalkAppId).toBe("string");
    expect(typeof ENV.dingTalkAgentId).toBe("string");
    expect(typeof ENV.dingTalkClientId).toBe("string");
    expect(typeof ENV.dingTalkClientSecret).toBe("string");
  });

  it("如果配置了凭证，Client ID 应符合钉钉格式", () => {
    if (ENV.dingTalkClientId) {
      // 钉钉 Client ID 以 "ding" 开头
      expect(ENV.dingTalkClientId).toMatch(/^ding/);
    }
  });
});
