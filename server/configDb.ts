/**
 * 战略配置 & 委员会配置数据库操作
 */
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { strategicConfig, committeeConfig } from "../drizzle/schema";

// ─── 战略配置 ─────────────────────────────────────────────────

export async function getStrategicConfig(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(strategicConfig).where(eq(strategicConfig.configKey, key)).limit(1);
  return rows[0] ?? null;
}

export async function getAllStrategicConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategicConfig);
}

export async function upsertStrategicConfig(key: string, value: unknown, updatedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(strategicConfig)
    .values({ configKey: key, configValue: value, updatedBy })
    .onDuplicateKeyUpdate({ set: { configValue: value, updatedBy } });
}

// ─── 委员会配置 ───────────────────────────────────────────────

export async function getAllCommitteeConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(committeeConfig);
}

export async function getCommitteeConfigById(id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(committeeConfig).where(eq(committeeConfig.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function upsertCommitteeConfig(
  data: {
    id: string;
    shortName: string;
    fullName: string;
    color: string;
    icon: string;
    chairman: string;
    director?: string | null;
    members?: string[] | null;
    responsibility?: string[] | null;
    annualGoal?: string | null;
    conditions?: string[] | null;
    rewardPool?: string | null;
    milestones?: unknown;
    status?: 'active' | 'paused' | 'terminated';
    dingTalkWebhook?: string | null;
  },
  updatedBy?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(committeeConfig)
    .values({ ...data, updatedBy })
    .onDuplicateKeyUpdate({
      set: {
        shortName: data.shortName,
        fullName: data.fullName,
        color: data.color,
        icon: data.icon,
        chairman: data.chairman,
        director: data.director,
        members: data.members,
        responsibility: data.responsibility,
        annualGoal: data.annualGoal,
        conditions: data.conditions,
        rewardPool: data.rewardPool,
        milestones: data.milestones,
        ...(data.status !== undefined ? { status: data.status as 'active' | 'paused' | 'terminated' } : {}),
        ...(data.dingTalkWebhook !== undefined ? { dingTalkWebhook: data.dingTalkWebhook } : {}),
        updatedBy,
      },
    });
}

export async function deleteCommitteeConfig(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(committeeConfig).where(eq(committeeConfig.id, id));
}
