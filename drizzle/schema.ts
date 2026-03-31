import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, json } from "drizzle-orm/mysql-core";

// ============================================================
// Manus OAuth 用户表（核心认证）
// ============================================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// 看板系统内部账号表
// ============================================================
export const kanbanUsers = mysqlTable("kanban_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  displayName: text("displayName").notNull(),
  role: mysqlEnum("role", ["admin", "committee"]).default("committee").notNull(),
  committeeId: varchar("committeeId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KanbanUser = typeof kanbanUsers.$inferSelect;
export type InsertKanbanUser = typeof kanbanUsers.$inferInsert;

// ============================================================
// 任务表（持久化存储，覆盖静态数据）
// ============================================================
export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 64 }).primaryKey(), // 如 qw-1, hjj-2 等
  committeeId: varchar("committeeId", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  goal: text("goal").notNull(),
  strategy: text("strategy").notNull(),
  /** JSON 数组存储行动清单 */
  actions: json("actions").$type<string[]>(),
  milestone: text("milestone"),
  result: text("result"),
  breakthrough: text("breakthrough"),
  manager: varchar("manager", { length: 100 }),
  /** 负责人钉钉 userId（用于工作通知精准推送） */
  managerUserId: varchar("managerUserId", { length: 100 }),
  /** JSON 数组存储协作成员 */
  contributors: json("contributors").$type<string[]>(),
  /** JSON 数组存储协作成员钉钉 userId 列表（与 contributors 一一对应） */
  contributorUserIds: json("contributorUserIds").$type<string[]>(),
  /** 钉钉部门 ID 列表 */
  dingDeptIds: json("dingDeptIds").$type<string[]>(),
  deadline: varchar("deadline", { length: 20 }),
  status: mysqlEnum("status", ["进行中", "已完成", "待启动", "有卡点", "已结束"]).default("待启动").notNull(),
  rewardPool: varchar("rewardPool", { length: 200 }),
  /** 投入工时（人天） */
  inputManDays: float("inputManDays"),
  /** 产出价值（元） */
  outputValue: float("outputValue"),
  /** 完成度百分比 0-100 */
  completionRate: float("completionRate").default(0),
  /** 积分（AI核算后填入） */
  score: float("score").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"), // kanban_users.id
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ============================================================
// 产出附件表（图片/文档）
// ============================================================
export const taskAttachments = mysqlTable("task_attachments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull(),
  committeeId: varchar("committeeId", { length: 64 }).notNull(),
  /** S3 文件 key */
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  /** CDN 公开 URL */
  url: text("url").notNull(),
  /** 原始文件名 */
  filename: varchar("filename", { length: 255 }).notNull(),
  /** MIME 类型 */
  mimeType: varchar("mimeType", { length: 100 }),
  /** 文件大小（字节） */
  fileSize: int("fileSize"),
  /** 上传者 kanban_users.id */
  uploadedBy: int("uploadedBy"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type InsertTaskAttachment = typeof taskAttachments.$inferInsert;

// ============================================================
// 积分记录表（AI核算结果）
// ============================================================
export const scoreRecords = mysqlTable("score_records", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull(),
  committeeId: varchar("committeeId", { length: 64 }).notNull(),
  /** 完成度积分（40%权重） */
  completionScore: float("completionScore").default(0).notNull(),
  /** 产出质量积分（30%权重） */
  qualityScore: float("qualityScore").default(0).notNull(),
  /** 时效积分（20%权重） */
  timelinessScore: float("timelinessScore").default(0).notNull(),
  /** 协作积分（10%权重） */
  collaborationScore: float("collaborationScore").default(0).notNull(),
  /** 综合积分 */
  totalScore: float("totalScore").default(0).notNull(),
  /** 投入产出比 */
  roi: float("roi"),
  /** 奖金系数 */
  bonusCoeff: float("bonusCoeff").default(0).notNull(),
  /** 预估奖金（元） */
  estimatedBonus: float("estimatedBonus").default(0).notNull(),
  /** AI 分析摘要 */
  aiSummary: text("aiSummary"),
  /** 项目价值等级：十万/百万/千万 */
  projectValueLevel: mysqlEnum("projectValueLevel", ["十万", "百万", "千万"]),
  /** 当前门位：S门/A门/B门 */
  gateName: mysqlEnum("gateName", ["S门", "A门", "B门"]),
  /** 月度积分 */
  monthlyScore: float("monthlyScore").default(0),
  /** 里程碑积分 */
  milestoneScore: float("milestoneScore").default(0),
  /** 辅导员积分 */
  mentorScore: float("mentorScore").default(0),
  /** 辅导员姓名 */
  mentorName: varchar("mentorName", { length: 100 }),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type ScoreRecord = typeof scoreRecords.$inferSelect;
export type InsertScoreRecord = typeof scoreRecords.$inferInsert;

// ============================================================
// 战略配置表（管理员可编辑战略目标、路径等）
// ============================================================
export const strategicConfig = mysqlTable("strategic_config", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("configKey", { length: 100 }).notNull().unique(),
  configValue: json("configValue"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type StrategicConfig = typeof strategicConfig.$inferSelect;

// ============================================================
// 委员会配置表（管理员可编辑委员会信息）
// ============================================================
export const committeeConfig = mysqlTable("committee_config", {
  id: varchar("id", { length: 64 }).primaryKey(),
  shortName: varchar("shortName", { length: 50 }).notNull(),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  icon: varchar("icon", { length: 20 }).notNull(),
  chairman: varchar("chairman", { length: 100 }).notNull(),
  director: varchar("director", { length: 100 }),
  members: json("members").$type<string[]>(),
  responsibility: json("responsibility").$type<string[]>(),
  annualGoal: text("annualGoal"),
  conditions: json("conditions").$type<string[]>(),
  rewardPool: text("rewardPool"),
  milestones: json("milestones"),
  /** 委员会状态：执行/暂缓/终止 */
  status: mysqlEnum("status", ["active", "paused", "terminated"]).default("active").notNull(),
  /** 钉钉机器人 Webhook URL */
  dingTalkWebhook: varchar("dingTalkWebhook", { length: 500 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type CommitteeConfig = typeof committeeConfig.$inferSelect;

// ============================================================
// 效益记录表（AI前后对比核算）
// ============================================================
export const outcomeRecords = mysqlTable("outcome_records", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull(),
  committeeId: varchar("committeeId", { length: 64 }).notNull(),
  /** 效益类型：提效/降本/增收 */
  type: mysqlEnum("type", ["提效", "降本", "增收"]).notNull(),
  /** 场景描述，如「合同审核」「客户报价」 */
  scenario: varchar("scenario", { length: 200 }).notNull(),
  /** AI介入前数值 */
  beforeValue: float("beforeValue").notNull(),
  /** AI介入后数值 */
  afterValue: float("afterValue").notNull(),
  /** 单位，如「小时/次」「元/月」「万元/年」 */
  unit: varchar("unit", { length: 50 }).notNull(),
  /** 频次（每月次数，用于年化计算） */
  frequency: float("frequency").default(1),
  /** 补充说明 */
  remark: text("remark"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OutcomeRecord = typeof outcomeRecords.$inferSelect;
export type InsertOutcomeRecord = typeof outcomeRecords.$inferInsert;
