/**
 * 任务相关数据库查询辅助函数
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  tasks, taskAttachments, scoreRecords, outcomeRecords,
  InsertTask, InsertTaskAttachment, InsertScoreRecord, InsertOutcomeRecord,
  Task, TaskAttachment, ScoreRecord, OutcomeRecord
} from "../drizzle/schema";
import { committees as staticCommittees } from "../client/src/data/kanbanData";
import { nanoid } from "nanoid";

// ─── 任务 CRUD ───────────────────────────────────────────────

/** 获取某委员会的所有任务（DB 优先，fallback 到静态数据） */
export async function getTasksByCommittee(committeeId: string): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).where(eq(tasks.committeeId, committeeId));
}

/** 获取所有任务 */
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks);
}

/** 根据 ID 获取任务 */
export async function getTaskById(id: string): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

/** 创建任务 */
export async function createTask(data: Omit<InsertTask, "id"> & { id?: string }): Promise<Task> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = data.id || `${data.committeeId}-${nanoid(6)}`;
  await db.insert(tasks).values({ ...data, id });
  const created = await getTaskById(id);
  if (!created) throw new Error("Failed to create task");
  return created;
}

/** 更新任务 */
export async function updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id));
  return getTaskById(id);
}

/** 删除任务 */
export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(eq(tasks.id, id));
  // 同时删除关联附件和积分记录
  await db.delete(taskAttachments).where(eq(taskAttachments.taskId, id));
  await db.delete(scoreRecords).where(eq(scoreRecords.taskId, id));
}

/** 初始化：将静态数据导入数据库（首次运行时） */
export async function seedTasksFromStatic(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(tasks).limit(1);
  if (existing.length > 0) return; // 已有数据，跳过

  for (const committee of staticCommittees) {
    for (const t of committee.tasks) {
      await db.insert(tasks).values({
        id: t.id,
        committeeId: committee.id,
        name: t.name,
        goal: t.goal,
        strategy: t.strategy,
        actions: t.actions,
        milestone: t.milestone,
        result: t.result,
        breakthrough: t.breakthrough,
        manager: t.manager,
        contributors: t.contributors,
        dingDeptIds: [],
        deadline: t.deadline,
        status: t.status,
        rewardPool: t.rewardPool,
        completionRate: t.status === "已完成" ? 100 : t.status === "进行中" ? 50 : t.status === "有卡点" ? 20 : 0,
        score: 0,
      }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
    }
  }
  console.log("[DB] Tasks seeded from static data");
}

// ─── 附件 CRUD ───────────────────────────────────────────────

/** 获取任务的所有附件 */
export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId));
}

/** 创建附件记录 */
export async function createTaskAttachment(data: InsertTaskAttachment): Promise<TaskAttachment> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(taskAttachments).values(data);
  const id = (result as any)[0]?.insertId;
  const created = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
  return created[0];
}

/** 删除附件 */
export async function deleteTaskAttachment(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
}

// ─── 积分记录 ─────────────────────────────────────────────────

/** 获取任务最新积分记录 */
export async function getLatestScoreRecord(taskId: string): Promise<ScoreRecord | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scoreRecords)
    .where(eq(scoreRecords.taskId, taskId))
    .limit(1);
  return result[0];
}

/** 获取委员会所有积分记录 */
export async function getCommitteeScoreRecords(committeeId: string): Promise<ScoreRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(scoreRecords).where(eq(scoreRecords.committeeId, committeeId));
}

/** 保存积分记录 */
export async function upsertScoreRecord(data: InsertScoreRecord): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // 先删旧记录再插入
  await db.delete(scoreRecords).where(eq(scoreRecords.taskId, data.taskId));
  await db.insert(scoreRecords).values(data);
}

// ─── 效益记录 CRUD ────────────────────────────────────────────

/** 获取任务的所有效益记录 */
export async function getOutcomesByTask(taskId: string): Promise<OutcomeRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(outcomeRecords).where(eq(outcomeRecords.taskId, taskId));
}

/** 获取委员会所有效益记录 */
export async function getOutcomesByCommittee(committeeId: string): Promise<OutcomeRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(outcomeRecords).where(eq(outcomeRecords.committeeId, committeeId));
}

/** 新增效益记录 */
export async function createOutcomeRecord(data: InsertOutcomeRecord): Promise<OutcomeRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(outcomeRecords).values(data);
  const id = (result as any)[0]?.insertId;
  const created = await db.select().from(outcomeRecords).where(eq(outcomeRecords.id, id)).limit(1);
  return created[0];
}

/** 更新效益记录 */
export async function updateOutcomeRecord(id: number, data: Partial<InsertOutcomeRecord>): Promise<OutcomeRecord | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(outcomeRecords).set({ ...data, updatedAt: new Date() }).where(eq(outcomeRecords.id, id));
  const result = await db.select().from(outcomeRecords).where(eq(outcomeRecords.id, id)).limit(1);
  return result[0];
}

/** 删除效益记录 */
export async function deleteOutcomeRecord(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(outcomeRecords).where(eq(outcomeRecords.id, id));
}
