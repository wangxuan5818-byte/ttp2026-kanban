import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql2 from "mysql2";
import { InsertUser, users, kanbanUsers, InsertKanbanUser, KanbanUser } from "../drizzle/schema";
import { ENV } from './_core/env';
import { createHash } from "crypto";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// Uses createPool for connection pooling and automatic reconnection on timeout.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql2.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// 看板用户相关查询
// ============================================================

/** 简单 SHA-256 密码哈希（生产环境建议用 bcrypt，此处轻量实现） */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password + "ttp2026_salt").digest("hex");
}

/** 根据用户名查找看板用户 */
export async function getKanbanUserByUsername(username: string): Promise<KanbanUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(kanbanUsers).where(eq(kanbanUsers.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 根据 ID 查找看板用户 */
export async function getKanbanUserById(id: number): Promise<KanbanUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(kanbanUsers).where(eq(kanbanUsers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 获取所有看板用户（管理员用） */
export async function getAllKanbanUsers(): Promise<KanbanUser[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(kanbanUsers);
}

/** 创建看板用户 */
export async function createKanbanUser(data: InsertKanbanUser): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(kanbanUsers).values(data);
}

/** 更新看板用户（重置密码、修改显示名、角色等） */
export async function updateKanbanUser(id: number, data: Partial<Pick<InsertKanbanUser, 'passwordHash' | 'displayName' | 'role' | 'committeeId'>>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(kanbanUsers).set({ ...data, updatedAt: new Date() }).where(eq(kanbanUsers.id, id));
}

/** 删除看板用户 */
export async function deleteKanbanUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(kanbanUsers).where(eq(kanbanUsers.id, id));
}

/**
 * 初始化默认账号（首次部署时调用）
 * 总管理员：admin / ttp2026admin
 * 各委员会账号：委员会ID / ttp2026@委员会ID
 */
export async function initDefaultKanbanUsers(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(kanbanUsers).limit(1);
  if (existing.length > 0) return; // 已初始化，跳过

  const defaultUsers: InsertKanbanUser[] = [
    // 总管理员
    {
      username: "admin",
      passwordHash: hashPassword("ttp2026admin"),
      displayName: "总管理员",
      role: "admin",
      committeeId: null,
    },
    // 各委员会账号
    { username: "qianwei", passwordHash: hashPassword("ttp2026@qianwei"), displayName: "前线委员会", role: "committee", committeeId: "qianwei" },
    { username: "huojunjun", passwordHash: hashPassword("ttp2026@huojunjun"), displayName: "火箭军", role: "committee", committeeId: "huojunjun" },
    { username: "yanwei", passwordHash: hashPassword("ttp2026@yanwei"), displayName: "研发委员会", role: "committee", committeeId: "yanwei" },
    { username: "zhengjiju", passwordHash: hashPassword("ttp2026@zhengjiju"), displayName: "政治局", role: "committee", committeeId: "zhengjiju" },
    { username: "shendunjv", passwordHash: hashPassword("ttp2026@shendunjv"), displayName: "神盾局", role: "committee", committeeId: "shendunjv" },
    { username: "ziguanwei", passwordHash: hashPassword("ttp2026@ziguanwei"), displayName: "资产管理委员会", role: "committee", committeeId: "ziguanwei" },
    { username: "jianwei", passwordHash: hashPassword("ttp2026@jianwei"), displayName: "检查委员会", role: "committee", committeeId: "jianwei" },
    { username: "haiwei", passwordHash: hashPassword("ttp2026@haiwei"), displayName: "海外委员会", role: "committee", committeeId: "haiwei" },
    { username: "zuzhihu", passwordHash: hashPassword("ttp2026@zuzhihu"), displayName: "组织部", role: "committee", committeeId: "zuzhihu" },
    { username: "caiwubu", passwordHash: hashPassword("ttp2026@caiwubu"), displayName: "财务部", role: "committee", committeeId: "caiwubu" },
    { username: "dangzuzhi", passwordHash: hashPassword("ttp2026@dangzuzhi"), displayName: "党组织", role: "committee", committeeId: "dangzuzhi" },
  ];

  for (const u of defaultUsers) {
    await db.insert(kanbanUsers).values(u).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  }

  console.log("[DB] Default kanban users initialized");
}
