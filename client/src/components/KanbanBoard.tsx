/*
 * 部门看板面板 - 纸质战情室风格
 * 展示单个部门的任务卡片、里程碑时间轴、责任规划
 * 支持：任务 CRUD、AI 积分核算、Excel 导入导出、图片识别导入、已结束任务折叠
 */

import { useState, useRef } from "react";
import type { Committee, Task as StaticTask } from "@/data/kanbanData";
import { trpc } from "@/lib/trpc";
import TaskEditor from "@/components/TaskEditor";
import ScorePanel from "@/components/ScorePanel";
import OutcomePanel from "@/components/OutcomePanel";
import { Plus, Edit2, Trash2, Sparkles, BarChart3, Loader2, AlertCircle, Download, Upload, Camera, ChevronDown, ChevronRight, Brain, FileSpreadsheet, RotateCcw, Braces, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface KanbanBoardProps {
  committee: Committee;
  onTaskClick: (task: StaticTask, dbTaskId?: string) => void;
  isAdmin: boolean;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  "进行中": { label: "进行中", cls: "status-active" },
  "已完成": { label: "已结束", cls: "status-done" },
  "待启动": { label: "待启动", cls: "status-pending" },
  "有卡点": { label: "有卡点", cls: "status-blocked" },
  "已结束": { label: "已结束", cls: "status-done" },
};

const milestoneStatusConfig = {
  "completed": { dot: "oklch(0.35 0.15 145)", line: "oklch(0.35 0.15 145)" },
  "in-progress": { dot: "oklch(0.42 0.18 22)", line: "oklch(0.42 0.18 22)" },
  "upcoming": { dot: "oklch(0.72 0.06 60)", line: "oklch(0.86 0.012 75)" },
};

// DB 任务类型（来自 tRPC）
type DbTask = {
  id: string;
  committeeId: string;
  name: string;
  goal: string;
  strategy: string;
  actions: string[] | null;
  milestone?: string | null;
  result?: string | null;
  breakthrough?: string | null;
  manager?: string | null;
  contributors: string[] | null;
  dingDeptIds: string[] | null;
  deadline?: string | null;
  status: "进行中" | "已完成" | "待启动" | "有卡点" | "已结束";
  rewardPool?: string | null;
  inputManDays?: number | null;
  outputValue?: number | null;
  completionRate: number | null;
  score?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type ActiveTab = "kanban" | "score" | "outcome";

// Excel 列标题映射
const EXCEL_COLUMNS = [
  { key: "name", label: "任务名称" },
  { key: "goal", label: "任务目标" },
  { key: "strategy", label: "执行策略" },
  { key: "actions", label: "行动计划（换行分隔）" },
  { key: "milestone", label: "关键里程碑" },
  { key: "result", label: "当前进展" },
  { key: "breakthrough", label: "突破方向" },
  { key: "manager", label: "负责人" },
  { key: "contributors", label: "协作成员（逗号分隔）" },
  { key: "deadline", label: "截止日期" },
  { key: "status", label: "状态" },
  { key: "rewardPool", label: "奖金机制" },
  { key: "completionRate", label: "完成度(%)" },
];

export default function KanbanBoard({ committee, onTaskClick, isAdmin }: KanbanBoardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("kanban");
  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
  const [prefillData, setPrefillData] = useState<any>(null);
  const [showToolMenu, setShowToolMenu] = useState(false);
  const [imageRecognizing, setImageRecognizing] = useState(false);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const jsonImportFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // ─── 导入（Excel）───────────────────────────────────────────
  const importFromJsonMutation = trpc.tasks.importFromJson.useMutation({
    onSuccess: (data) => {
      utils.tasks.list.invalidate({ committeeId: committee.id });
      toast.success(`成功导入 ${data.count} 个任务`);
    },
    onError: (err) => toast.error(`导入失败：${err.message}`),
  });

  // ─── 图片识别 ────────────────────────────────────────────────
  const recognizeImageMutation = trpc.tasks.recognizeImage.useMutation({
    onSuccess: (data) => {
      // 修复：将识别结果作为 prefillData 传给 TaskEditor
      setPrefillData(data);
      setEditingTask(null);
      setShowEditor(true);
      setImageRecognizing(false);
      toast.success("图片识别完成，请检查并确认任务信息");
    },
    onError: (err) => {
      setImageRecognizing(false);
      toast.error(`图片识别失败：${err.message}`);
    },
  });

  const restoreMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ committeeId: committee.id });
      toast.success("任务已恢复到进行中");
    },
    onError: (err) => toast.error(`恢复失败：${err.message}`),
  });

  const handleRestoreTask = (taskId: string) => {
    restoreMutation.mutate({ id: taskId, status: "进行中", completionRate: 50 });
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "任务名称", "任务目标", "执行策略", "行动计划（换行分隔）",
        "关键里程碑", "当前进展", "突破方向", "负责人",
        "协作成员（逗号分隔）", "截止日期", "状态", "奖金机制", "完成度(%)",
      ],
      [
        "示例：AI 能力建设", "提升团队 AI 应用水平", "分阶段培训+实战演练",
        "第一步：需求调研\n第二步：方案设计",
        "Q2 完成首期培训", "已完成调研阶段", "引入外部专家资源",
        "张三", "李四, 王五", "2026-06-30", "进行中", "完成后奖励 5000 元", "30",
      ],
    ]);
    ws["!cols"] = [
      { wch: 24 }, { wch: 32 }, { wch: 28 }, { wch: 40 },
      { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 10 },
      { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "任务模板");
    XLSX.writeFile(wb, `任务导入模板_${committee.shortName}.xlsx`);
    toast.success("模板已下载，请按格式填写后导入");
  };

  const handleExportTasks = () => {
    const rows = allTasks.map(t => ({
      "任务名称": t.name,
      "任务目标": t.goal || "",
      "执行策略": t.strategy || "",
      "行动计划（换行分隔）": (t.actions || []).join("\n"),
      "关键里程碑": t.milestone || "",
      "当前进展": t.result || "",
      "突破方向": t.breakthrough || "",
      "负责人": t.manager || "",
      "协作成员（逗号分隔）": (t.contributors || []).join(", "),
      "截止日期": t.deadline || "",
      "状态": t.status,
      "奖金机制": t.rewardPool || "",
      "完成度(%)": t.completionRate ?? 0,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // 设置列宽
    ws["!cols"] = [
      { wch: 24 }, { wch: 32 }, { wch: 28 }, { wch: 40 },
      { wch: 28 }, { wch: 28 }, { wch: 24 }, { wch: 10 },
      { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, committee.shortName);
    XLSX.writeFile(wb, `${committee.shortName}_任务_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`已导出 ${rows.length} 个任务到 Excel`);
  };

  // ─── 导出 JSON ───────────────────────────────────────────────
  const handleExportJson = () => {
    const exportData = allTasks.map(t => ({
      name: t.name,
      goal: t.goal || "",
      strategy: t.strategy || "",
      actions: t.actions || [],
      milestone: t.milestone || "",
      result: t.result || "",
      breakthrough: t.breakthrough || "",
      manager: t.manager || "",
      contributors: t.contributors || [],
      deadline: t.deadline || "",
      status: t.status,
      rewardPool: t.rewardPool || "",
      completionRate: t.completionRate ?? 0,
    }));
    const json = JSON.stringify({ committeeId: committee.id, tasks: exportData }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${committee.shortName}_任务_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${exportData.length} 个任务到 JSON`);
  };

  // ─── 导入 JSON ───────────────────────────────────────────────
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        // 支持两种格式：{ committeeId, tasks: [...] } 或直接 [...]
        const rawTasks: any[] = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
        if (rawTasks.length === 0) {
          toast.error("JSON 文件中未找到有效任务数据");
          return;
        }
        const tasks = rawTasks
          .filter((row: any) => row.name?.toString().trim())
          .map((row: any) => ({
            name: row.name?.toString().trim() || "",
            goal: row.goal?.toString() || "",
            strategy: row.strategy?.toString() || "",
            actions: Array.isArray(row.actions) ? row.actions : [],
            milestone: row.milestone?.toString() || "",
            result: row.result?.toString() || "",
            breakthrough: row.breakthrough?.toString() || "",
            manager: row.manager?.toString() || "",
            contributors: Array.isArray(row.contributors) ? row.contributors : [],
            deadline: row.deadline?.toString() || "",
            status: (["进行中", "已完成", "待启动", "有卡点", "已结束"].includes(row.status)
              ? row.status
              : "待启动") as "进行中" | "已完成" | "待启动" | "有卡点" | "已结束",
            rewardPool: row.rewardPool?.toString() || "",
            completionRate: Number(row.completionRate) || 0,
          }));
        if (tasks.length === 0) {
          toast.error("未找到有效任务（需含 name 字段）");
          return;
        }
        importFromJsonMutation.mutate({ committeeId: committee.id, tasks });
      } catch (err: any) {
        toast.error(`JSON 解析失败：${err.message}`);
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const tasks = rows
          .filter(row => row["任务名称"]?.toString().trim())
          .map(row => ({
            name: row["任务名称"]?.toString().trim() || "",
            goal: row["任务目标"]?.toString() || "",
            strategy: row["执行策略"]?.toString() || "",
            actions: row["行动计划（换行分隔）"]
              ? row["行动计划（换行分隔）"].toString().split(/[\n\r]+/).filter(Boolean)
              : [],
            milestone: row["关键里程碑"]?.toString() || "",
            result: row["当前进展"]?.toString() || "",
            breakthrough: row["突破方向"]?.toString() || "",
            manager: row["负责人"]?.toString() || "",
            contributors: row["协作成员（逗号分隔）"]
              ? row["协作成员（逗号分隔）"].toString().split(/[,，]+/).map((s: string) => s.trim()).filter(Boolean)
              : [],
            deadline: row["截止日期"]?.toString() || "",
            status: (["进行中", "已完成", "待启动", "有卡点", "已结束"].includes(row["状态"])
              ? row["状态"]
              : "待启动") as "进行中" | "已完成" | "待启动" | "有卡点" | "已结束",
            rewardPool: row["奖金机制"]?.toString() || "",
            completionRate: Number(row["完成度(%)"]) || 0,
          }));

        if (tasks.length === 0) {
          toast.error("未找到有效任务数据，请确认 Excel 格式正确");
          return;
        }
        importFromJsonMutation.mutate({ committeeId: committee.id, tasks });
      } catch (err: any) {
        toast.error(`文件解析失败：${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImageRecognize = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageRecognizing(true);
    toast.info("正在识别图片，请稍候…");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload-image", { method: "POST", body: formData, credentials: "include" });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || `上传失败 (${uploadRes.status})`);
      }
      const { url } = await uploadRes.json();
      recognizeImageMutation.mutate({ committeeId: committee.id, imageUrl: url });
    } catch (err: any) {
      setImageRecognizing(false);
      toast.error(`图片上传失败：${err.message}`);
    }
    e.target.value = "";
  };

  // ─── 从 DB 获取任务 ──────────────────────────────────────────
  const { data: dbTasks, isLoading: tasksLoading, refetch: refetchTasks } = trpc.tasks.list.useQuery(
    { committeeId: committee.id },
    { retry: 1 }
  );

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ committeeId: committee.id });
      toast.success("任务已删除");
    },
    onError: (err) => toast.error(`删除失败：${err.message}`),
  });

  // 合并静态数据与 DB 数据
  const staticTasks: DbTask[] = (committee.tasks || []).map(t => ({
    id: t.id,
    committeeId: committee.id,
    name: t.name,
    goal: t.goal,
    strategy: t.strategy || "",
    actions: t.actions || [],
    milestone: t.milestone || "",
    result: t.result || "",
    breakthrough: t.breakthrough || "",
    manager: t.manager || "",
    contributors: t.contributors || [],
    dingDeptIds: [],
    deadline: t.deadline || "",
    status: t.status as DbTask["status"],
    rewardPool: t.rewardPool || "",
    inputManDays: null,
    outputValue: null,
    completionRate: 0,
    score: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const allTasks: DbTask[] = dbTasks && dbTasks.length > 0 ? dbTasks : staticTasks;

  // 分组：活跃任务 vs 已结束任务（隐藏 2025 年及以前的已结束任务，不计入 2026 年度）
  const activeTasks = allTasks.filter(t => t.status !== "已结束" && t.status !== "已完成");
  const archivedTasks = allTasks.filter(t =>
    (t.status === "已结束" || t.status === "已完成") &&
    !(t.deadline && t.deadline < "2026-01-01")
  );

  const activeTasksByStatus = {
    "进行中": activeTasks.filter(t => t.status === "进行中"),
    "有卡点": activeTasks.filter(t => t.status === "有卡点"),
    "待启动": activeTasks.filter(t => t.status === "待启动"),
  };

  const handleDeleteTask = (taskId: string, taskName: string) => {
    if (!confirm(`确认删除任务「${taskName}」？此操作不可撤销。`)) return;
    deleteMutation.mutate({ id: taskId });
  };

  const handleEditorSaved = () => {
    setShowEditor(false);
    setEditingTask(null);
    setPrefillData(null);
    refetchTasks();
  };

  return (
    <div className="p-6 animate-fade-in-up">
      {/* 委员会标题区 */}
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-sm flex items-center justify-center text-2xl shadow-sm"
              style={{ background: `${committee.color}15`, border: `2px solid ${committee.color}40` }}
            >
              {committee.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {committee.fullName}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {committee.chairman && <span>主席：{committee.chairman}</span>}
                {committee.director && <span>主任：{committee.director}</span>}
                <span className="text-[10px] font-mono" style={{ color: committee.color }}>
                  {allTasks.length}项任务
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 奖金池标签 */}
            {committee.rewardPool && (
              <div
                className="text-xs px-3 py-1.5 rounded-sm max-w-[240px] text-right"
                style={{
                  background: 'oklch(0.95 0.05 75)',
                  border: '1px solid oklch(0.78 0.10 75)',
                  color: 'oklch(0.45 0.12 75)',
                }}
              >
                <div className="text-[10px] font-medium mb-0.5">奖金池</div>
                <div className="leading-relaxed">{committee.rewardPool}</div>
              </div>
            )}
            {/* 工具菜单（导入/导出/图片识别） */}
            <div className="relative">
              <button
                onClick={() => setShowToolMenu(v => !v)}
                className="flex items-center gap-1 px-2.5 py-2 text-xs rounded-sm font-medium transition-all border"
                style={{ background: 'oklch(0.96 0.008 75)', border: '1px solid oklch(0.82 0.015 75)', color: 'oklch(0.35 0.02 60)' }}
                title="导入/导出/图片识别"
              >
                <ChevronDown size={13} />
              </button>
              {showToolMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-sm shadow-lg py-1 min-w-[160px]"
                  style={{ background: 'oklch(0.99 0.004 75)', border: '1px solid oklch(0.86 0.012 75)' }}
                >
                  <button
                    onClick={() => { handleExportTasks(); setShowToolMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <FileSpreadsheet size={12} /> 导出 Excel
                  </button>
                  <button
                    onClick={() => { importFileRef.current?.click(); setShowToolMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <Upload size={12} /> 导入 Excel
                  </button>
                  <button
                    onClick={() => { handleDownloadTemplate(); setShowToolMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <Download size={12} /> 下载导入模板
                  </button>
                  <div style={{ borderTop: '1px solid oklch(0.90 0.010 75)', margin: '2px 0' }} />
                  <button
                    onClick={() => { handleExportJson(); setShowToolMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <Braces size={12} /> 导出 JSON
                  </button>
                  <button
                    onClick={() => { jsonImportFileRef.current?.click(); setShowToolMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <Upload size={12} /> 导入 JSON
                  </button>
                  <div style={{ borderTop: '1px solid oklch(0.90 0.010 75)', margin: '2px 0' }} />
                  <button
                    onClick={() => { imageFileRef.current?.click(); setShowToolMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                    disabled={imageRecognizing}
                  >
                    {imageRecognizing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    {imageRecognizing ? "识别中…" : "图片识别导入"}
                  </button>
                </div>
              )}
              {/* 隐藏文件输入 */}
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
              <input ref={jsonImportFileRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />
              <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageRecognize} />
            </div>
            {/* 新建任务按钮 */}
            <button
              onClick={() => { setEditingTask(null); setPrefillData(null); setShowEditor(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-sm font-medium transition-all hover:opacity-90"
              style={{ background: committee.color, color: 'white' }}
            >
              <Plus size={13} /> 新建任务
            </button>
          </div>
        </div>

        {/* 年度目标 */}
        <div
          className="mt-4 p-3 rounded-sm text-sm"
          style={{
            background: `${committee.color}08`,
            borderLeft: `3px solid ${committee.color}`,
            borderTop: `1px solid ${committee.color}20`,
            borderRight: `1px solid ${committee.color}20`,
            borderBottom: `1px solid ${committee.color}20`,
          }}
        >
          <span className="text-xs font-medium mr-2" style={{ color: committee.color }}>年度目标</span>
          <span className="text-foreground">{committee.annualGoal}</span>
        </div>

        {/* 职责标签 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {committee.responsibility.map((r, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-sm"
              style={{
                background: 'oklch(0.94 0.008 75)',
                border: '1px solid oklch(0.86 0.012 75)',
                color: 'oklch(0.42 0.015 60)',
              }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* 标签切换：看板 / 积分核算 / 效益核算 */}
      <div className="flex gap-0 mb-5" style={{ borderBottom: '1px solid oklch(0.88 0.012 75)' }}>
        {([
          { id: "kanban" as ActiveTab, label: "任务看板", icon: null },
          { id: "score" as ActiveTab, label: "积分核算", icon: Sparkles },
          { id: "outcome" as ActiveTab, label: "效益核算", icon: TrendingUp },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all"
            style={{
              color: activeTab === id ? 'oklch(0.42 0.18 22)' : 'oklch(0.55 0.015 60)',
              borderBottom: activeTab === id ? '2px solid oklch(0.42 0.18 22)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {Icon && <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>

      {/* 积分面板 */}
      {activeTab === "score" && (
        <ScorePanel committeeId={committee.id} isAdmin={isAdmin} />
      )}

      {/* 效益核算面板 */}
      {activeTab === "outcome" && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground px-0.5">
            记录 AI 介入前后的对比数据，量化提效、降本、增收三类效益，自动计算年化收益。
          </div>
          {allTasks.filter(t => t.status !== "已结束" && t.status !== "已完成" && !(t.deadline && t.deadline < "2026-01-01")).length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">暂无进行中任务</div>
          ) : (
            allTasks.filter(t => t.status !== "已结束" && t.status !== "已完成" && !(t.deadline && t.deadline < "2026-01-01")).map(task => (
              <div key={task.id} className="rounded-sm overflow-hidden" style={{ border: '1px solid oklch(0.88 0.012 75)' }}>
                <div
                  className="px-4 py-2 text-xs font-semibold"
                  style={{ background: 'oklch(0.96 0.008 75)', borderBottom: '1px solid oklch(0.88 0.012 75)', fontFamily: "'Noto Serif SC', serif" }}
                >
                  <span style={{ color: committee.color }}>◆</span> {task.name}
                </div>
                <div className="p-4">
                  <OutcomePanel
                    committeeId={committee.id}
                    taskId={task.id}
                    committeeColor={committee.color}
                    taskName={task.name}
                    inputManDays={task.inputManDays ?? undefined}
                    outputValue={task.outputValue ?? undefined}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 任务看板 */}
      {activeTab === "kanban" && (
        <div className="grid grid-cols-3 gap-6">
          {/* 任务看板 - 左侧2列 */}
          <div className="col-span-2 space-y-5">
            {tasksLoading && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'oklch(0.55 0.015 60)' }}>
                <Loader2 size={14} className="animate-spin" /> 加载任务中...
              </div>
            )}

            {/* 活跃任务：进行中 / 有卡点 / 待启动 */}
            {(["进行中", "有卡点", "待启动"] as const).map((status) => {
              const tasks = activeTasksByStatus[status];
              if (tasks.length === 0) return null;
              const cfg = statusConfig[status];
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`${cfg.cls} text-xs px-2 py-0.5 rounded-sm font-medium`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{tasks.length}</span>
                    <div className="flex-1 border-t border-dashed border-border" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 animate-stagger">
                    {tasks.map((task) => (
                      <DbTaskCard
                        key={task.id}
                        task={task}
                        committeeColor={committee.color}
                        onEdit={() => { setEditingTask(task); setPrefillData(null); setShowEditor(true); }}
                        onDelete={() => handleDeleteTask(task.id, task.name)}
                        onClick={() => {
                          const staticTask: StaticTask = {
                            id: task.id,
                            name: task.name,
                            goal: task.goal,
                            strategy: task.strategy || "",
                            actions: task.actions || [],
                            milestone: task.milestone || "",
                            result: task.result || "",
                            breakthrough: task.breakthrough || "",
                            manager: task.manager || "",
                            contributors: task.contributors || [],
                            deadline: task.deadline || "",
                            status: task.status,
                            rewardPool: task.rewardPool || "",
                          };
                          onTaskClick(staticTask, task.id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 已结束任务归档区域（折叠） */}
            {archivedTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setArchivedExpanded(v => !v)}
                  className="flex items-center gap-2 mb-3 w-full group"
                >
                  <span
                    className="text-xs px-2 py-0.5 rounded-sm font-medium"
                    style={{ background: 'oklch(0.93 0.005 60)', color: 'oklch(0.52 0.015 60)', border: '1px solid oklch(0.86 0.012 75)' }}
                  >
                    已结束归档
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{archivedTasks.length}</span>
                  <div className="flex-1 border-t border-dashed border-border" />
                  <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-0.5">
                    {archivedExpanded ? (
                      <><ChevronDown size={12} /> 收起</>
                    ) : (
                      <><ChevronRight size={12} /> 展开查看</>
                    )}
                  </span>
                </button>

                {archivedExpanded && (
                  <div className="grid grid-cols-1 gap-3 animate-stagger">
                    {archivedTasks.map((task) => (
                      <DbTaskCard
                        key={task.id}
                        task={task}
                        committeeColor="oklch(0.72 0.06 60)"
                        onEdit={() => { setEditingTask(task); setPrefillData(null); setShowEditor(true); }}
                        onDelete={() => handleDeleteTask(task.id, task.name)}
                        onRestore={() => handleRestoreTask(task.id)}
                        onClick={() => {
                          const staticTask: StaticTask = {
                            id: task.id,
                            name: task.name,
                            goal: task.goal,
                            strategy: task.strategy || "",
                            actions: task.actions || [],
                            milestone: task.milestone || "",
                            result: task.result || "",
                            breakthrough: task.breakthrough || "",
                            manager: task.manager || "",
                            contributors: task.contributors || [],
                            deadline: task.deadline || "",
                            status: task.status,
                            rewardPool: task.rewardPool || "",
                          };
                          onTaskClick(staticTask, task.id);
                        }}
                        archived
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!tasksLoading && allTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: 'oklch(0.65 0.015 60)' }}>
                <AlertCircle size={32} className="mb-3 opacity-30" />
                <p className="text-sm">暂无任务</p>
                <p className="text-xs mt-1">点击右上角「新建任务」开始添加</p>
              </div>
            )}
          </div>

          {/* 右侧：里程碑 + 成员 */}
          <div className="space-y-5">
            {/* 里程碑时间轴 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                <span className="w-1 h-4 rounded-sm inline-block" style={{ background: committee.color }} />
                目标路径里程碑
              </h3>
              <div className="space-y-0">
                {(committee.milestones || []).map((m, i) => {
                  const cfg = milestoneStatusConfig[m.status as keyof typeof milestoneStatusConfig] || milestoneStatusConfig.upcoming;
                  const isLast = i === (committee.milestones || []).length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-1"
                          style={{ background: cfg.dot, border: `2px solid ${cfg.dot}` }}
                        />
                        {!isLast && (
                          <div className="w-0.5 flex-1 my-1" style={{ background: cfg.line, opacity: 0.4 }} />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="text-xs font-medium text-foreground leading-relaxed">{m.event}</div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: cfg.dot }}>{m.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 成员规划 */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                <span className="w-1 h-4 rounded-sm inline-block" style={{ background: 'oklch(0.35 0.12 200)' }} />
                委员会成员
              </h3>
              <div className="space-y-2">
                {(committee.members || []).map((member, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 p-2 rounded-sm"
                    style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.90 0.008 75)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${committee.color}15`, color: committee.color }}
                    >
                      {(typeof member === 'string' ? member : (member as any).name || '').slice(-1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        {typeof member === 'string' ? member : (member as any).name || ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 奖金达成条件 */}
            {committee.conditions && committee.conditions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  <span className="w-1 h-4 rounded-sm inline-block" style={{ background: 'oklch(0.35 0.12 200)' }} />
                  奖金达成条件
                </h3>
                <div className="space-y-1.5">
                  {committee.conditions.map((cond, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs p-2 rounded-sm"
                      style={{
                        background: 'oklch(0.97 0.004 80)',
                        border: '1px solid oklch(0.86 0.012 75)',
                      }}
                    >
                      <span
                        className="shrink-0 w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold mt-0.5"
                        style={{ background: 'oklch(0.35 0.12 200)', color: 'oklch(0.98 0.002 60)' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-foreground">{cond}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 任务编辑器弹窗 */}
      {showEditor && (
        <TaskEditor
          committeeId={committee.id}
          taskId={editingTask?.id}
          isAiRecognized={!!prefillData && !editingTask}
          initialData={
            prefillData
              ? prefillData  // 图片识别预填数据优先
              : editingTask
              ? {
                  name: editingTask.name,
                  goal: editingTask.goal,
                  strategy: editingTask.strategy || "",
                  actions: editingTask.actions || [],
                  milestone: editingTask.milestone || "",
                  result: editingTask.result || "",
                  breakthrough: editingTask.breakthrough || "",
                  manager: editingTask.manager || "",
                  contributors: editingTask.contributors || [],
                  dingDeptIds: editingTask.dingDeptIds || [],
                  deadline: editingTask.deadline || "",
                  status: editingTask.status,
                  rewardPool: editingTask.rewardPool || "",
                  inputManDays: editingTask.inputManDays || undefined,
                  outputValue: editingTask.outputValue || undefined,
                  completionRate: editingTask.completionRate ?? 0,
                }
              : undefined
          }
          onClose={() => { setShowEditor(false); setEditingTask(null); setPrefillData(null); }}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
}

// ─── DB 任务卡片 ──────────────────────────────────────────────
function DbTaskCard({
  task,
  committeeColor,
  onClick,
  onEdit,
  onDelete,
  onRestore,
  archived = false,
}: {
  task: DbTask;
  committeeColor: string;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  archived?: boolean;
}) {
  const cfg = statusConfig[task.status] || statusConfig["待启动"];

  return (
    <div
      className="war-card rounded-sm p-4 text-left w-full group relative"
      style={{
        borderLeftColor: committeeColor,
        opacity: archived ? 0.75 : 1,
        filter: archived ? 'grayscale(0.3)' : 'none',
      }}
    >
      {/* 操作按钮（悬浮显示） */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {archived && onRestore && (
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            className="p-1.5 rounded-sm hover:bg-green-50 transition-colors"
            title="恢复任务"
          >
            <RotateCcw size={11} style={{ color: 'oklch(0.42 0.15 145)' }} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-sm hover:bg-black/10 transition-colors"
          title="编辑任务"
        >
          <Edit2 size={11} style={{ color: 'oklch(0.45 0.015 60)' }} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-sm hover:bg-red-50 transition-colors"
          title="删除任务"
        >
          <Trash2 size={11} style={{ color: 'oklch(0.55 0.18 22)' }} />
        </button>
      </div>

      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-2 mb-2 pr-14">
          <h4 className="text-sm font-semibold text-foreground group-hover:text-[oklch(0.42_0.18_22)] transition-colors" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {task.name}
          </h4>
          <span className={`${cfg.cls} text-[10px] px-1.5 py-0.5 rounded-sm font-medium shrink-0`}>
            {cfg.label}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
          {task.goal}
        </p>

        {/* 完成度进度条 */}
        {(task.completionRate ?? 0) > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px]" style={{ color: 'oklch(0.65 0.015 60)' }}>完成度</span>
              <span className="text-[10px] font-mono" style={{ color: committeeColor }}>{task.completionRate}%</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: 'oklch(0.92 0.01 80)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${task.completionRate}%`, background: committeeColor }}
              />
            </div>
          </div>
        )}

        {/* 行动项预览 */}
        {task.actions && task.actions.length > 0 && (
          <div className="space-y-1 mb-3">
            {task.actions.slice(0, 2).map((action, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                <span className="shrink-0 mt-0.5" style={{ color: committeeColor }}>▸</span>
                <span className="line-clamp-1">{action}</span>
              </div>
            ))}
            {task.actions.length > 2 && (
              <div className="text-[10px] text-muted-foreground pl-3.5">
                +{task.actions.length - 2} 项行动...
              </div>
            )}
          </div>
        )}

        {/* 底部信息 */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed border-border">
          <div className="flex items-center gap-2">
            {task.manager ? (
              <>
                <div
                  className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold"
                  style={{ background: `${committeeColor}15`, color: committeeColor }}
                >
                  {task.manager.slice(-1)}
                </div>
                <span className="text-[10px] text-muted-foreground">{task.manager}</span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">未指定负责人</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.contributors && task.contributors.length > 1 && (
              <span className="text-[10px] text-muted-foreground">
                +{task.contributors.length - 1}人协作
              </span>
            )}
            {task.score && task.score > 0 && (
              <span className="text-[10px] font-mono flex items-center gap-0.5" style={{ color: 'oklch(0.42 0.18 22)' }}>
                <Sparkles size={9} />{task.score.toFixed(0)}分
              </span>
            )}
            {task.deadline && (
              <span className="text-[10px] font-mono text-muted-foreground">{task.deadline}</span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
