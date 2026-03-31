/**
 * 战略总览面板 - 纸质战情室风格
 * 部门卡片：每行一个，展示重点任务列表
 * 数据来源：DB（实时同步）+ 静态数据（fallback）
 * 改进：
 *  - 暂缓/终止部门排到后面，不展示任务内容
 *  - 重点任务只展示未完成，按截止日期最近排序
 *  - 统计卡片点击高亮并跳转
 *  - 本周新增/完成计数
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown, GripVertical, CheckCircle2, RotateCcw, MoreHorizontal } from "lucide-react";
import type { Committee, Task } from "@/data/kanbanData";
import { monthlyStrategy as staticMonthly, strategicGoal as staticGoal } from "@/data/kanbanData";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import GlobalOutcomePanel from "@/components/GlobalOutcomePanel";

interface OverviewPanelProps {
  committees: Committee[];
  onSelectCommittee: (id: string) => void;
  onTaskClick: (task: Task) => void;
  onCreateTask?: (committeeId: string) => void;
}

// 部门状态标签配置
const COMMITTEE_STATUS_OPTIONS = {
  active: { label: "执行中", color: "oklch(0.45 0.18 145)", bg: "oklch(0.45 0.18 145 / 0.1)", border: "oklch(0.45 0.18 145 / 0.3)" },
  paused: { label: "暂缓", color: "oklch(0.55 0.18 60)", bg: "oklch(0.55 0.18 60 / 0.1)", border: "oklch(0.55 0.18 60 / 0.3)" },
  terminated: { label: "终止", color: "oklch(0.42 0.18 22)", bg: "oklch(0.42 0.18 22 / 0.1)", border: "oklch(0.42 0.18 22 / 0.3)" },
} as const;

// 任务状态样式
const TASK_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  "进行中": { color: "oklch(0.35 0.15 250)", bg: "oklch(0.35 0.15 250 / 0.1)" },
  "已完成": { color: "oklch(0.55 0.01 60)", bg: "oklch(0.55 0.01 60 / 0.08)" },
  "待启动": { color: "oklch(0.55 0.02 60)", bg: "oklch(0.55 0.02 60 / 0.08)" },
  "有卡点": { color: "oklch(0.42 0.18 22)", bg: "oklch(0.42 0.18 22 / 0.1)" },
  "已结束": { color: "oklch(0.55 0.01 60)", bg: "oklch(0.55 0.01 60 / 0.08)" },
};

// 快速切换状态选项（不含已结束，已结束通过专用按钮触发）
const QUICK_STATUS_OPTIONS = ["待启动", "进行中", "有卡点"] as const;

// 默认展示的重点任务数量
const DEFAULT_KEY_TASK_LIMIT = 3;

// 迷你折线图组件（SVG，近4周趋势）
function SparkLine({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 60, H = 24, PAD = 2;
  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
      {data.map((v, i) => {
        const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
        const y = H - PAD - ((v / max) * (H - PAD * 2));
        return <circle key={i} cx={x} cy={y} r="2" fill={color} opacity="0.9" />;
      })}
    </svg>
  );
}

// 高亮过滤类型
type HighlightFilter = "all" | "inProgress" | "blocked" | "done";

// 截止日期倒计时（返回剩余天数，负数表示已过期）
function getDaysUntilDeadline(deadline: string): number | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  if (isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const progressPercent = (tasks: Task[]) => {
  const total = tasks.length;
  if (total === 0) return 0;
  const done = tasks.filter(t => t.status === "已结束" || t.status === "已完成").length;
  const inProgress = tasks.filter(t => t.status === "进行中").length;
  return Math.round(((done + inProgress * 0.5) / total) * 100);
};

// 未完成任务排序：优先有卡点，其次进行中，再次待启动；同状态内按截止日期最近排序
const getSortedActiveTasks = (tasks: Task[]) => {
  const statusPriority = { "有卡点": 0, "进行中": 1, "待启动": 2 };
  return tasks
    .filter(t => t.status !== "已结束" && t.status !== "已完成") // 只展示未结束
    .sort((a, b) => {
      const pa = statusPriority[a.status as keyof typeof statusPriority] ?? 9;
      const pb = statusPriority[b.status as keyof typeof statusPriority] ?? 9;
      if (pa !== pb) return pa - pb;
      // 同状态内按截止日期升序（最近的在前）
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1; // 有截止日期的排前面
      if (b.deadline) return 1;
      return 0;
    });
};

export default function OverviewPanel({ committees, onSelectCommittee, onTaskClick, onCreateTask }: OverviewPanelProps) {
  // 每个委员会卡片的展开状态
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  // 统计卡片高亮过滤
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>("all");
  // 委员会列表 ref，用于滚动到顶部
  const committeeListRef = useRef<HTMLDivElement>(null);
  // 拖拽排序状态
  const [dragOrder, setDragOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartIndex = useRef<number>(-1);

  // 从 DB 读取战略配置（实时同步）
  const { data: strategicConfigs } = trpc.config.getStrategicConfigs.useQuery();
  // 从 DB 读取委员会配置（实时同步）
  const { data: committeeConfigs } = trpc.config.getCommitteeConfigs.useQuery();
  // 从 DB 读取所有任务（实时同步）
  const { data: allDbTasks } = trpc.tasks.listAll.useQuery();
  // 本周统计
  const { data: weeklyStats } = trpc.tasks.weeklyStats.useQuery();
  // 近4周趋势
  const { data: weeklyTrend } = trpc.tasks.weeklyTrend.useQuery();

  // 状态快速切换菜单
  const [quickMenuTaskId, setQuickMenuTaskId] = useState<string | null>(null);
  // 已结束任务展开状态
  const [endedExpandedMap, setEndedExpandedMap] = useState<Record<string, boolean>>({});

  const utils = trpc.useUtils();

  // 标记任务为已结束（带撤销Toast）
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate();
      utils.tasks.weeklyStats.invalidate();
    },
  });

  const handleEndTask = useCallback((taskId: string, taskName: string, prevStatus: string) => {
    updateTask.mutate({ id: taskId, status: "已结束" });
    let undone = false;
    toast(
      <div className="flex items-center gap-2">
        <span className="text-sm">「{taskName}」已标记为已结束</span>
        <button
          className="ml-2 text-xs underline font-medium"
          style={{ color: 'oklch(0.42 0.18 22)' }}
          onClick={() => {
            if (!undone) {
              undone = true;
              updateTask.mutate({ id: taskId, status: prevStatus as any });
              toast.dismiss();
            }
          }}
        >
          <RotateCcw size={11} className="inline mr-0.5" />撤销
        </button>
      </div>,
      { duration: 5000 }
    );
  }, [updateTask]);

  const handleQuickStatus = useCallback((taskId: string, status: string) => {
    updateTask.mutate({ id: taskId, status: status as any });
    setQuickMenuTaskId(null);
  }, [updateTask]);

  // 点击其他区域关闭快速菜单
  useEffect(() => {
    if (!quickMenuTaskId) return;
    const handler = () => setQuickMenuTaskId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [quickMenuTaskId]);

  // 旧名兼容
  const completeTask = updateTask;

  // 合并 DB 战略配置（优先 DB，fallback 静态数据）
  const getConfigValue = (key: string, fallback: unknown) => {
    const found = strategicConfigs?.find(c => c.configKey === key);
    return found ? found.configValue : fallback;
  };
  const goal = getConfigValue("strategicGoal", staticGoal) as typeof staticGoal;
  const monthly = getConfigValue("monthlyStrategy", staticMonthly) as typeof staticMonthly;

  // 合并委员会配置（DB 覆盖静态数据）
  const getEffectiveCommittee = (c: Committee) => {
    const dbConfig = committeeConfigs?.find(d => d.id === c.id);
    const dbTasks = (allDbTasks || []).filter(t => t.committeeId === c.id);
    const effectiveTasks: Task[] = dbTasks.length > 0
      ? dbTasks.map(t => ({
          id: t.id,
          name: t.name,
          goal: t.goal,
          strategy: t.strategy,
          actions: (t.actions as string[]) || [],
          milestone: t.milestone || "",
          result: t.result || "",
          breakthrough: t.breakthrough || "",
          manager: t.manager || "",
          contributors: (t.contributors as string[]) || [],
          dingDeptIds: (t.dingDeptIds as string[]) || [],
          deadline: t.deadline || "",
          status: t.status as Task["status"],
          rewardPool: t.rewardPool || "",
          inputManDays: t.inputManDays || undefined,
          outputValue: t.outputValue || undefined,
          completionRate: t.completionRate || 0,
          score: t.score || 0,
        }))
      : c.tasks;

    return {
      ...c,
      shortName: dbConfig?.shortName ?? c.shortName,
      fullName: dbConfig?.fullName ?? c.fullName,
      color: dbConfig?.color ?? c.color,
      icon: dbConfig?.icon ?? c.icon,
      chairman: dbConfig?.chairman ?? c.chairman,
      director: dbConfig?.director ?? c.director,
      members: (dbConfig?.members as string[]) ?? c.members,
      responsibility: (dbConfig?.responsibility as string[]) ?? c.responsibility,
      annualGoal: dbConfig?.annualGoal ?? c.annualGoal,
      conditions: (dbConfig?.conditions as string[]) ?? c.conditions,
      rewardPool: dbConfig?.rewardPool ?? c.rewardPool,
      committeeStatus: (dbConfig?.status ?? "active") as keyof typeof COMMITTEE_STATUS_OPTIONS,
      tasks: effectiveTasks,
    };
  };

  const allEffectiveCommittees = committees.map(getEffectiveCommittee);

  // 排序：执行中在前，暂缓/终止在后
  const activeCommittees = allEffectiveCommittees.filter(c => c.committeeStatus === "active");
  const inactiveCommittees = allEffectiveCommittees.filter(c => c.committeeStatus !== "active");

  // 应用拖拽排序（仅对执行中委员会）
  const sortedActiveCommittees = dragOrder.length > 0
    ? [...activeCommittees].sort((a, b) => {
        const ia = dragOrder.indexOf(a.id);
        const ib = dragOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
    : activeCommittees;

  const effectiveCommittees = [...sortedActiveCommittees, ...inactiveCommittees];
  // 拖拽排序用的 id 列表
  const activeOrderIds = sortedActiveCommittees.map(c => c.id);

  const totalTasks = effectiveCommittees.reduce((s, c) => s + c.tasks.length, 0);
  const inProgressTasks = effectiveCommittees.reduce((s, c) => s + c.tasks.filter(t => t.status === "进行中").length, 0);
  const blockedTasks = effectiveCommittees.reduce((s, c) => s + c.tasks.filter(t => t.status === "有卡点").length, 0);
  const doneTasks = effectiveCommittees.reduce((s, c) => s + c.tasks.filter(t => t.status === "已结束" || t.status === "已完成").length, 0);

  const toggleExpand = (committeeId: string) => {
    setExpandedMap(prev => ({ ...prev, [committeeId]: !prev[committeeId] }));
  };

  // 拖拽排序处理（仅对执行中委员会有效）
  const handleDragStart = useCallback((id: string, index: number) => {
    setDragId(id);
    dragStartIndex.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback((targetId: string, currentOrder: string[]) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const newOrder = [...currentOrder];
    const fromIdx = newOrder.indexOf(dragId);
    const toIdx = newOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragId);
    setDragOrder(newOrder);
    setDragId(null);
    setDragOverId(null);
  }, [dragId]);

  // 点击统计卡片：设置高亮过滤并滚动到委员会列表
  const handleStatClick = (filter: HighlightFilter) => {
    setHighlightFilter(prev => prev === filter ? "all" : filter);
    setTimeout(() => {
      committeeListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // 判断委员会是否在当前高亮过滤中
  const isCommitteeHighlighted = (committee: ReturnType<typeof getEffectiveCommittee>) => {
    if (highlightFilter === "all") return false;
    if (highlightFilter === "inProgress") return committee.tasks.some(t => t.status === "进行中");
    if (highlightFilter === "blocked") return committee.tasks.some(t => t.status === "有卡点");
    if (highlightFilter === "done") return committee.tasks.some(t => t.status === "已结束" || t.status === "已完成");
    return false;
  };

  const statCards = [
    { label: "战略任务总数", value: totalTasks, color: "oklch(0.12 0.015 60)", filter: "all" as HighlightFilter, activeColor: "oklch(0.12 0.015 60)" },
    { label: "进行中", value: inProgressTasks, color: "oklch(0.35 0.15 145)", filter: "inProgress" as HighlightFilter, activeColor: "oklch(0.35 0.15 145)" },
    { label: "有卡点", value: blockedTasks, color: "oklch(0.38 0.18 22)", filter: "blocked" as HighlightFilter, activeColor: "oklch(0.38 0.18 22)" },
    { label: "已结束", value: doneTasks, color: "oklch(0.35 0.12 200)", filter: "done" as HighlightFilter, activeColor: "oklch(0.35 0.12 200)" },
  ];

  return (
    <div className="p-6 animate-fade-in-up">
      {/* 战略目标横幅 */}
      <div
        className="rounded-sm p-5 mb-6 relative overflow-hidden"
        style={{ background: 'oklch(0.42 0.18 22)', color: 'oklch(0.98 0.002 60)' }}
      >
        <div className="absolute right-4 top-4 text-6xl opacity-10 font-bold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          突围
        </div>
        <div className="relative">
          <div className="text-xs tracking-widest opacity-70 mb-1">2026年度核心战略</div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {(goal as typeof staticGoal).projectName}
          </h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>目标金额：<strong>{(goal as typeof staticGoal).totalTarget}</strong></span>
            <span>截止日期：<strong>{(goal as typeof staticGoal).deadline}</strong></span>
            <span>协同体系：<strong>{(goal as typeof staticGoal).collaboration}</strong></span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(goal as typeof staticGoal).paths?.map((path, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-sm"
                style={{ background: 'oklch(0.98 0.002 60 / 0.15)', border: '1px solid oklch(0.98 0.002 60 / 0.3)' }}
              >
                路径{i + 1}：{path}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 统计数字 - 可点击高亮 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => {
          const isActive = highlightFilter === stat.filter && stat.filter !== "all";
          return (
            <button
              key={stat.label}
              onClick={() => handleStatClick(stat.filter)}
              className="war-card rounded-sm p-4 text-left transition-all duration-200 hover:shadow-md"
              style={{
                outline: isActive ? `2px solid ${stat.activeColor}` : "none",
                outlineOffset: "2px",
                background: isActive ? `${stat.activeColor}08` : undefined,
              }}
            >
              <div className="text-3xl font-bold font-mono mb-1" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              {isActive && (
                <div className="text-[9px] mt-1 font-medium" style={{ color: stat.activeColor }}>
                  点击取消高亮
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 近4周任务完成趋势迷你图 */}
      {weeklyTrend && weeklyTrend.some(w => w.done > 0) && (
        <div className="war-card rounded-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              近4周任务完成趋势
            </div>
            <div className="text-[10px] text-muted-foreground">每周已结束任务数</div>
          </div>
          <div className="flex items-end gap-6">
            <SparkLine data={weeklyTrend.map(w => w.done)} color="oklch(0.35 0.15 145)" />
            <div className="flex gap-4">
              {weeklyTrend.map((w, i) => (
                <div key={i} className="text-center">
                  <div className="text-sm font-bold font-mono" style={{ color: 'oklch(0.35 0.15 145)' }}>{w.done}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{w.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 主体：左侧委员会列表 + 右侧月度战略 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 委员会列表 - 单列，每行一个 */}
        <div className="col-span-2" ref={committeeListRef}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            <span className="w-1 h-4 rounded-sm inline-block" style={{ background: 'oklch(0.42 0.18 22)' }} />
            各部门任务进度
            {highlightFilter !== "all" && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                （已高亮筛选）
              </span>
            )}
          </h3>
          <div className="space-y-3 animate-stagger">
            {effectiveCommittees.map((committee) => {
              const pct = progressPercent(committee.tasks);
              const blocked = committee.tasks.filter(t => t.status === "有卡点").length;
              const statusStyle = COMMITTEE_STATUS_OPTIONS[committee.committeeStatus as keyof typeof COMMITTEE_STATUS_OPTIONS] || COMMITTEE_STATUS_OPTIONS.active;
              const isInactive = committee.committeeStatus === "paused" || committee.committeeStatus === "terminated";
              const highlighted = isCommitteeHighlighted(committee);
              const dimmed = highlightFilter !== "all" && !highlighted;

              // 只对执行中委员会展示任务内容
              const endedTasks = committee.tasks.filter(t => t.status === "已结束" || t.status === "已完成");
              const isEndedExpanded = endedExpandedMap[committee.id] ?? false;

              // 本周统计
              const weekly = weeklyStats?.[committee.id];
              // 环形图数据
              const totalCount = committee.tasks.length;
              const endedCount = endedTasks.length;
              const inProgressCount = committee.tasks.filter(t => t.status === '进行中').length;
              const blockedCount = committee.tasks.filter(t => t.status === '有卡点').length;
              const pendingCount = committee.tasks.filter(t => t.status === '待启动').length;

              return (
                <div
                  key={committee.id}
                  className="war-card rounded-sm overflow-hidden relative transition-all duration-300"
                  draggable={!isInactive}
                  onDragStart={() => !isInactive && handleDragStart(committee.id, sortedActiveCommittees.indexOf(committee))}
                  onDragOver={(e) => !isInactive && handleDragOver(e, committee.id)}
                  onDrop={() => !isInactive && handleDrop(committee.id, activeOrderIds)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  style={{
                    borderLeftColor: committee.color,
                    opacity: isInactive ? 0.6 : dimmed ? 0.4 : 1,
                    outline: dragOverId === committee.id && !isInactive
                      ? `2px dashed ${committee.color}`
                      : highlighted ? `2px solid ${committee.color}` : "none",
                    outlineOffset: "2px",
                    cursor: !isInactive ? 'grab' : 'default',
                    transform: dragId === committee.id ? 'scale(0.98) opacity(0.7)' : undefined,
                  }}
                >
                  {/* 暂缓/终止状态：斜纹遮罩 */}
                  {isInactive && (
                    <div
                      className="absolute inset-0 pointer-events-none z-10 rounded-sm"
                      style={{
                        background: committee.committeeStatus === "terminated"
                          ? "repeating-linear-gradient(45deg, oklch(0.42 0.18 22 / 0.05) 0px, oklch(0.42 0.18 22 / 0.05) 2px, transparent 2px, transparent 10px)"
                          : "repeating-linear-gradient(45deg, oklch(0.55 0.18 60 / 0.05) 0px, oklch(0.55 0.18 60 / 0.05) 2px, transparent 2px, transparent 10px)",
                        borderRadius: "inherit",
                      }}
                    />
                  )}

                  {/* 卡片头部区域 */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between">
                      {/* 左侧：拖拽把手 + 图标 + 名称 + 负责人 */}
                      <div className="flex items-center gap-1">
                        {!isInactive && (
                          <span className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-grab active:cursor-grabbing" title="拖拽排序">
                            <GripVertical size={14} />
                          </span>
                        )}
                      <button
                        onClick={() => onSelectCommittee(committee.id)}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                      >
                        <span className="text-xl">{committee.icon}</span>
                        <div>
                          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                            {committee.shortName}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {committee.chairman || committee.director}
                          </div>
                        </div>
                      </button>
                      </div> {/* end flex items-center gap-1 */}

                      {/* 右侧：进度 + 状态 + 本周统计 + 快速新建 */}
                      <div className="flex items-center gap-2">
                        {/* 本周统计（仅执行中委员会显示） */}
                        {!isInactive && weekly && (weekly.newCount > 0 || weekly.doneCount > 0) && (
                          <div className="flex flex-col items-end gap-0.5">
                            {weekly.newCount > 0 && (
                              <div className="flex items-center gap-0.5 text-[9px]" style={{ color: "oklch(0.35 0.15 250)" }}>
                                <TrendingUp size={9} />
                                <span>本周新增 {weekly.newCount}</span>
                              </div>
                            )}
                            {weekly.doneCount > 0 && (
                              <div className="flex items-center gap-0.5 text-[9px]" style={{ color: "oklch(0.45 0.18 145)" }}>
                                <TrendingDown size={9} />
                                <span>本周完成 {weekly.doneCount}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* 小型环形图 */}
                        {totalCount > 0 && !isInactive && (
                          <svg width="36" height="36" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                            {(() => {
                              const cx = 18, cy = 18, r = 14, stroke = 3;
                              const circumference = 2 * Math.PI * r;
                              const segments = [
                                { count: endedCount, color: 'oklch(0.55 0.01 60)' },
                                { count: inProgressCount, color: 'oklch(0.35 0.15 250)' },
                                { count: blockedCount, color: 'oklch(0.42 0.18 22)' },
                                { count: pendingCount, color: 'oklch(0.75 0.01 60)' },
                              ].filter(s => s.count > 0);
                              let offset = 0;
                              return (
                                <>
                                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="oklch(0.9 0.01 60)" strokeWidth={stroke} />
                                  {segments.map((seg, i) => {
                                    const pctSeg = seg.count / totalCount;
                                    const dash = pctSeg * circumference;
                                    const gap = circumference - dash;
                                    const rotation = -90 + (offset / totalCount) * 360;
                                    offset += seg.count;
                                    return (
                                      <circle
                                        key={i}
                                        cx={cx} cy={cy} r={r}
                                        fill="none"
                                        stroke={seg.color}
                                        strokeWidth={stroke}
                                        strokeDasharray={`${dash} ${gap}`}
                                        strokeDashoffset={0}
                                        transform={`rotate(${rotation} ${cx} ${cy})`}
                                        style={{ transition: 'stroke-dasharray 0.4s ease' }}
                                      />
                                    );
                                  })}
                                  <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="7" fontWeight="600" fill={committee.color}>{pct}%</text>
                                </>
                              );
                            })()}
                          </svg>
                        )}
                        <div className="text-right">
                          <div className="text-xs font-mono font-semibold" style={{ color: committee.color }}>{pct}%</div>
                          <div className="text-[10px] text-muted-foreground">{committee.tasks.length}个任务</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-sm font-medium"
                            style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
                          >
                            {statusStyle.label}
                          </span>
                          {blocked > 0 && (
                            <span className="status-blocked text-[10px] px-1.5 py-0.5 rounded-sm font-medium">
                              {blocked}卡点
                            </span>
                          )}
                        </div>
                        {/* 快速新建任务按钮（仅执行中委员会显示） */}
                        {onCreateTask && !isInactive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateTask(committee.id);
                            }}
                            title="快速新建任务"
                            className="flex items-center justify-center w-6 h-6 rounded-sm transition-all duration-150 hover:scale-110 active:scale-95 relative z-20"
                            style={{
                              background: committee.color + "20",
                              border: `1px solid ${committee.color}50`,
                              color: committee.color,
                            }}
                          >
                            <Plus size={12} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* 进度条 */}
                    <div className="progress-war h-1.5 mt-2">
                      <div className="progress-war-fill" style={{ width: `${pct}%`, background: committee.color }} />
                    </div>
                  </div>

                  {/* 本周结果对比区块 */}
                  {!isInactive && (() => {
                    const tasksWithResult = committee.tasks.filter(t =>
                      t.result && t.result.trim() !== '' &&
                      (t.status === '进行中' || t.status === '已完成' || t.status === '有卡点')
                    );
                    if (tasksWithResult.length === 0) return null;
                    const isResultExpanded = expandedMap[committee.id] ?? false; // 默认折叠
                    return (
                      <div className="px-4 pb-3 border-t border-border/50">
                        <div className="flex items-center gap-1.5 mt-2 mb-2">
                          <button
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => toggleExpand(committee.id)}
                          >
                            {isResultExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            <span style={{ color: committee.color }} className="font-semibold">本周结果</span>
                            <span className="opacity-60">({tasksWithResult.length}项)</span>
                          </button>
                        </div>
                        {isResultExpanded ? (
                          <div className="space-y-1.5">
                            {tasksWithResult.map(task => {
                              const ts = TASK_STATUS_STYLE[task.status] || TASK_STATUS_STYLE["进行中"];
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => onTaskClick(task)}
                                  className="w-full text-left rounded-sm px-2.5 py-2 hover:opacity-90 transition-opacity group"
                                  style={{
                                    background: `${committee.color}08`,
                                    borderLeft: `2px solid ${committee.color}60`,
                                  }}
                                >
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">{task.name}</span>
                                    <span
                                      className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-sm font-medium"
                                      style={{ color: ts.color, background: ts.bg }}
                                    >{task.status}</span>
                                  </div>
                                  <div className="text-[10px] leading-relaxed" style={{ color: 'oklch(0.45 0.01 60)' }}>
                                    {task.result!.length > 80 ? task.result!.slice(0, 80) + '…' : task.result}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {tasksWithResult.filter(t => t.status === '进行中').map(task => {
                              const ts = TASK_STATUS_STYLE[task.status] || TASK_STATUS_STYLE["进行中"];
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => onTaskClick(task)}
                                  className="w-full text-left rounded-sm px-2.5 py-2 hover:opacity-90 transition-opacity group"
                                  style={{
                                    background: `${committee.color}08`,
                                    borderLeft: `2px solid ${committee.color}60`,
                                  }}
                                >
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[10px] font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">{task.name}</span>
                                    <span
                                      className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-sm font-medium"
                                      style={{ color: ts.color, background: ts.bg }}
                                    >{task.status}</span>
                                  </div>
                                  <div className="text-[10px] leading-relaxed" style={{ color: 'oklch(0.45 0.01 60)' }}>
                                    {task.result!.length > 80 ? task.result!.slice(0, 80) + '…' : task.result}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}



                  {/* 已结束任务区域（仅执行中委员会展示） */}
                  {!isInactive && endedTasks.length > 0 && (
                    <div className="px-4 pb-2 border-t border-border/30">
                      <button
                        className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setEndedExpandedMap(prev => ({ ...prev, [committee.id]: !prev[committee.id] }))}
                      >
                        {isEndedExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        <span>已结束任务</span>
                        <span className="opacity-60">({endedTasks.length})</span>
                      </button>
                      {isEndedExpanded && (
                        <div className="space-y-1 mt-1.5">
                          {endedTasks.map(task => (
                            <button
                              key={task.id}
                              onClick={() => onTaskClick(task)}
                              className="w-full flex items-center gap-2 text-left px-2 py-1 rounded-sm hover:bg-accent/30 transition-colors opacity-60 group relative z-20"
                            >
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                              <span className="flex-1 text-[11px] text-muted-foreground truncate line-through">
                                {task.name}
                              </span>
                              {task.deadline && (
                                <span className="shrink-0 text-[9px] font-mono text-muted-foreground/60">
                                  {task.deadline}
                                </span>
                              )}
                              {/* 撤销已结束：恢复为进行中 */}
                              <span
                                role="button"
                                title="恢复为进行中"
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-blue-500 p-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTask.mutate({ id: task.id, status: "进行中" });
                                }}
                              >
                                <RotateCcw size={11} />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 暂缓/终止委员会：简短提示 */}
                  {isInactive && (
                    <div className="px-4 pb-3 border-t border-border/30">
                      <div className="mt-2 text-[10px] text-muted-foreground italic">
                        {committee.committeeStatus === "terminated" ? "该部门已终止，任务不再展示" : "该部门暂缓执行，点击查看详情"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：月度战略 + 卡点预警 */}
        <div className="space-y-4">
          {/* 月度战略重点 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              <span className="w-1 h-4 rounded-sm inline-block" style={{ background: 'oklch(0.78 0.12 75)' }} />
              战略路径里程碑
            </h3>
            <div className="space-y-2 milestone-line">
              {(monthly as typeof staticMonthly).map((item, i) => (
                <div key={i} className="flex gap-3 pl-6 relative">
                  <div
                    className="absolute left-0 top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: i === 0 ? 'oklch(0.42 0.18 22)' : i === 1 ? 'oklch(0.78 0.12 75)' : 'oklch(0.86 0.012 75)',
                      color: i < 2 ? 'oklch(0.98 0.002 60)' : 'oklch(0.52 0.02 60)',
                      border: i === 2 ? '1px dashed oklch(0.72 0.06 60)' : 'none',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="war-card rounded-sm p-3 flex-1 border-l-0" style={{ borderLeft: 'none' }}>
                    <div className="text-[10px] font-mono font-medium mb-1" style={{ color: 'oklch(0.42 0.18 22)' }}>
                      {item.month}
                    </div>
                    <div className="text-xs text-foreground leading-relaxed">{item.focus}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 全局效益汇总 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              <span className="w-1 h-4 rounded-sm inline-block" style={{ background: 'oklch(0.35 0.12 200)' }} />
              全局效益汇总
            </h3>
            <GlobalOutcomePanel />
          </div>

          {/* 卡点预警 */}
          {effectiveCommittees.some(c => c.committeeStatus === "active" && c.tasks.some(t => t.status === "有卡点")) && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'oklch(0.38 0.18 22)', fontFamily: "'Noto Serif SC', serif" }}>
                <span className="w-1 h-4 rounded-sm inline-block" style={{ background: 'oklch(0.42 0.18 22)' }} />
                卡点预警 ({blockedTasks})
              </h3>
              <div className="space-y-2">
                {effectiveCommittees
                  .filter(c => c.committeeStatus === "active")
                  .flatMap(c =>
                    c.tasks.filter(t => t.status === "有卡点").map(t => ({ ...t, committeeName: c.shortName, committeeColor: c.color }))
                  ).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="w-full text-left war-card rounded-sm p-3 hover:shadow-md transition-all duration-200"
                      style={{ borderLeftColor: task.committeeColor }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                          style={{ background: `${task.committeeColor}20`, color: task.committeeColor }}
                        >
                          {task.committeeName}
                        </span>
                        {task.deadline && (
                          <span className="text-[9px] text-muted-foreground font-mono">{task.deadline}</span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-foreground">{task.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{task.breakthrough}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
