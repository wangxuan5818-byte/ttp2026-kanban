/*
 * TTP2026 AI战略看板 - 主页面（含登录认证）
 * 设计风格：纸质战情室（War Room Paper）
 * 布局：登录页 → 左侧委员会导航 + 中间任务看板 + 右侧详情面板
 */

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import KanbanBoard from "@/components/KanbanBoard";
import TaskDetail from "@/components/TaskDetail";
import OverviewPanel from "@/components/OverviewPanel";
import LoginPage from "@/components/LoginPage";
import { committees, strategicGoal } from "@/data/kanbanData";
import type { Task } from "@/data/kanbanData";
import { trpc } from "@/lib/trpc";
import { LogOut, User, BookOpen, Shield, FileText, Bell, Settings2, Sparkles } from "lucide-react";
import AgentPanel from "@/components/AgentPanel";
import Guide from "@/pages/Guide";
import UserManager from "@/components/UserManager";
import WeeklyReport from "@/components/WeeklyReport";
import DingTalkNotify from "@/components/DingTalkNotify";
import GlobalEditor from "@/components/GlobalEditor";
import CommitteeEditor from "@/components/CommitteeEditor";
import TaskEditor from "@/components/TaskEditor";
import QuickCreateModal from "@/components/QuickCreateModal";
export default function Home() {
  const [activeCommitteeId, setActiveCommitteeId] = useState<string>("overview");
  const [quickCreateCommitteeId, setQuickCreateCommitteeId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskDbId, setSelectedTaskDbId] = useState<string | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showDingTalk, setShowDingTalk] = useState(false);
  const [showGlobalEditor, setShowGlobalEditor] = useState(false);
  const [showCommitteeEditor, setShowCommitteeEditor] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  // 详情面板编辑模式
  const [detailEditTask, setDetailEditTask] = useState<Task | null>(null);
  const [detailEditCommitteeId, setDetailEditCommitteeId] = useState<string>("");

  // 获取当前登录的看板用户
  const { data: kanbanUser, isLoading: authLoading, refetch: refetchMe } = trpc.kanban.me.useQuery(
    undefined,
    { retry: false, staleTime: 0 }
  );
  const utils = trpc.useUtils();
  const logoutMutation = trpc.kanban.logout.useMutation({
    onSuccess: () => {
      utils.kanban.me.invalidate();
      utils.invalidate();
      setActiveCommitteeId("overview");
      setDetailOpen(false);
      // 强制刷新页面，确保所有状态和缓存完全清除
      window.location.reload();
    },
  });

  const handleLoginSuccess = () => {
    utils.kanban.me.invalidate();
  };

  // 从 DB 读取委员会配置（状态、排序等），仅在已登录时查询
  const { data: committeeConfigs } = trpc.config.getCommitteeConfigs.useQuery(undefined, {
    enabled: !!kanbanUser,
  });

  // 根据权限过滤委员会列表
  const rawVisibleCommittees = kanbanUser?.role === "admin"
    ? committees
    : committees.filter(c => c.id === kanbanUser?.committeeId);

  // 将数据库委员会配置合并到静态数据（数据库配置优先）
  const mergedCommittees = rawVisibleCommittees.map(c => {
    const dbConfig = committeeConfigs?.find(d => d.id === c.id);
    if (!dbConfig) return c;
    return {
      ...c,
      shortName: dbConfig.shortName ?? c.shortName,
      fullName: dbConfig.fullName ?? c.fullName,
      color: dbConfig.color ?? c.color,
      icon: dbConfig.icon ?? c.icon,
      chairman: dbConfig.chairman ?? c.chairman,
      director: dbConfig.director ?? c.director,
      members: (dbConfig.members as string[]) ?? c.members,
      responsibility: (dbConfig.responsibility as string[]) ?? c.responsibility,
      annualGoal: dbConfig.annualGoal ?? c.annualGoal,
      conditions: (dbConfig.conditions as string[]) ?? c.conditions,
      rewardPool: dbConfig.rewardPool ?? c.rewardPool,
    };
  });

  // 将数据库中的自定义部门（不在静态列表中的）也合并进来
  const staticIds = new Set(committees.map(c => c.id));
  const customDbCommittees = (committeeConfigs || []).filter(d => !staticIds.has(d.id)).map(d => ({
    id: d.id,
    shortName: d.shortName || d.id,
    fullName: d.fullName || d.shortName || d.id,
    color: (d as any).color || "#8B4513",
    icon: (d as any).icon || "🏢",
    chairman: d.chairman || "",
    director: d.director || "",
    members: [] as string[],
    responsibility: [] as string[],
    annualGoal: d.annualGoal || "",
    conditions: [] as string[],
    rewardPool: d.rewardPool || "",
    tasks: [] as import("@/data/kanbanData").Task[],
    milestones: [] as import("@/data/kanbanData").Milestone[],
  }));

  const allMergedCommittees = [
    ...mergedCommittees,
    ...(kanbanUser?.role === "admin" ? customDbCommittees : customDbCommittees.filter(c => c.id === kanbanUser?.committeeId)),
  ];

  // 按委员会状态排序：执行中在前，暂缓/终止在后
  const visibleCommittees = [...allMergedCommittees].sort((a, b) => {
    const statusA = committeeConfigs?.find(c => c.id === a.id)?.status ?? "active";
    const statusB = committeeConfigs?.find(c => c.id === b.id)?.status ?? "active";
    const order = { active: 0, paused: 1, terminated: 2 };
    return (order[statusA as keyof typeof order] ?? 0) - (order[statusB as keyof typeof order] ?? 0);
  });

  const activeCommittee = visibleCommittees.find(c => c.id === activeCommitteeId) || null;

  const handleTaskClick = (task: Task, dbTaskId?: string) => {
    setSelectedTask(task);
    setSelectedTaskDbId(dbTaskId);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setTimeout(() => { setSelectedTask(null); setSelectedTaskDbId(undefined); }, 300);
  };
  const handleEditFromDetail = () => {
    if (!selectedTask || !selectedTaskDbId) return;
    const committee = visibleCommittees.find(c => c.tasks.some(t => t.id === selectedTask.id));
    setDetailEditTask(selectedTask);
    setDetailEditCommitteeId(committee?.id || activeCommitteeId);
    setDetailOpen(false);
  };

  // 加载中
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-sm flex items-center justify-center text-lg font-bold animate-pulse"
            style={{ background: 'oklch(0.42 0.18 22)', color: 'oklch(0.98 0.002 60)' }}
          >
            T
          </div>
          <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>
            正在验证身份...
          </div>
        </div>
      </div>
    );
  }

  // 未登录：显示登录页
  if (!kanbanUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 委员会成员：自动切换到本委员会
  const effectiveActiveId =
    kanbanUser.role === "committee" && activeCommitteeId === "overview"
      ? (kanbanUser.committeeId || "overview")
      : activeCommitteeId;

  const effectiveCommittee = visibleCommittees.find(c => c.id === effectiveActiveId) || null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧导航 */}
      <Sidebar
        committees={visibleCommittees}
        activeId={effectiveActiveId}
        onSelect={(id: string) => {
          setActiveCommitteeId(id);
          setDetailOpen(false);
        }}
        showOverview={kanbanUser.role === "admin"}
      />

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* 顶部战略横幅 */}
        <header
          className="relative shrink-0 px-6 py-4 border-b border-border overflow-hidden"
          style={{
            backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663453940112/itrmCPuiVJQYLPwJLMeptv/hero-banner-mm8uBKsvyWQbVpXWrW3T5k.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        >
          <div className="absolute inset-0 bg-[oklch(0.975_0.008_80/0.88)]" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="stamp-badge text-[oklch(0.42_0.18_22)] text-xs px-2 py-0.5">
                  机密
                </span>
                <h1 className="text-xl font-bold text-foreground tracking-wide" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  TTP2026 · AI战略会
                </h1>
                {kanbanUser.role === "committee" && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-sm"
                    style={{ background: 'oklch(0.42 0.18 22 / 0.1)', color: 'oklch(0.42 0.18 22)', border: '1px solid oklch(0.42 0.18 22 / 0.3)' }}
                  >
                    {kanbanUser.displayName}专属视图
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {strategicGoal.projectName} · 目标 {strategicGoal.totalTarget} · 截止 {strategicGoal.deadline}
              </p>
            </div>

            <div className="flex items-center gap-6">
              {/* 统计数字（仅管理员显示全局统计） */}
              {kanbanUser.role === "admin" && (
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-[oklch(0.42_0.18_22)]">
                      {committees.length}
                    </div>
                    <div className="text-muted-foreground text-xs">委员会</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-[oklch(0.42_0.18_22)]">
                      {committees.reduce((sum, c) => sum + c.tasks.length, 0)}
                    </div>
                    <div className="text-muted-foreground text-xs">战略任务</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-[oklch(0.55_0.18_145)]">
                      {committees.reduce((sum, c) => sum + c.tasks.filter(t => t.status === "进行中").length, 0)}
                    </div>
                    <div className="text-muted-foreground text-xs">进行中</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-[oklch(0.55_0.18_22)]">
                      {committees.reduce((sum, c) => sum + c.tasks.filter(t => t.status === "有卡点").length, 0)}
                    </div>
                    <div className="text-muted-foreground text-xs">有卡点</div>
                  </div>
                </div>
              )}

              {/* 用户信息 + 登出 */}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm"
                  style={{
                    background: 'oklch(0.94 0.008 75)',
                    border: '1px solid oklch(0.86 0.012 75)',
                  }}
                >
                  <User size={13} className="text-muted-foreground" />
                  <span className="text-foreground font-medium">{kanbanUser.displayName}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-sm"
                    style={{
                      background: kanbanUser.role === "admin" ? 'oklch(0.42 0.18 22)' : 'oklch(0.35 0.12 200)',
                      color: 'oklch(0.98 0.002 60)',
                    }}
                  >
                    {kanbanUser.role === "admin" ? "总管理员" : "部门"}
                  </span>
                </div>
                {/* 管理员专属功能按鈕 */}
                {kanbanUser.role === "admin" && (
                  <>
                    <button
                      onClick={() => setShowGlobalEditor(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors"
                      style={{ border: '1px solid oklch(0.42 0.18 22)', background: 'oklch(0.42 0.18 22 / 0.08)', color: 'oklch(0.42 0.18 22)' }}
                      title="全局内容管理（战略目标/部门/任务）"
                    >
                      <Settings2 size={13} />
                      <span>内容管理</span>
                    </button>
                    <button
                      onClick={() => setShowUserManager(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors"
                      style={{ border: '1px solid oklch(0.86 0.012 75)' }}
                      title="账号管理"
                    >
                      <Shield size={13} />
                      <span>账号</span>
                    </button>
                    <button
                      onClick={() => setShowDingTalk(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors"
                      style={{ border: '1px solid oklch(0.86 0.012 75)' }}
                      title="钉钉通知配置"
                    >
                      <Bell size={13} />
                      <span>钉钉</span>
                    </button>
                  </>
                )}
                {/* 部门成员专属：管理任务按鈕 */}
                {kanbanUser.role === "committee" && effectiveCommittee && (
                  <button
                    onClick={() => setShowCommitteeEditor(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors"
                    style={{ border: '1px solid oklch(0.42 0.18 22)', background: 'oklch(0.42 0.18 22 / 0.08)', color: 'oklch(0.42 0.18 22)' }}
                    title="管理本部门任务"
                  >
                    <Settings2 size={13} />
                    <span>管理任务</span>
                  </button>
                )}
                {/* 周报导出（委员会和管理员均可用） */}
                {effectiveActiveId !== "overview" && (
                  <button
                    onClick={() => setShowWeeklyReport(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors"
                    style={{ border: '1px solid oklch(0.86 0.012 75)' }}
                    title="导出周报 PDF"
                  >
                    <FileText size={13} />
                    <span>周报</span>
                  </button>
                )}
                <button
                  onClick={() => setShowGuide(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors"
                  style={{ border: '1px solid oklch(0.86 0.012 75)' }}
                  title="填写说明书 & 看板介绍"
                >
                  <BookOpen size={13} />
                  <span>说明书</span>
                </button>
                <button
                  onClick={() => setShowAgentPanel(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors"
                  style={showAgentPanel
                    ? { border: '1px solid oklch(0.42 0.18 22)', background: 'oklch(0.42 0.18 22)', color: 'white' }
                    : { border: '1px solid oklch(0.42 0.18 22)', background: 'oklch(0.42 0.18 22 / 0.08)', color: 'oklch(0.42 0.18 22)' }
                  }
                  title="AI 助手"
                >
                  <Sparkles size={13} />
                  <span>AI 助手</span>
                </button>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors"
                  style={{ border: '1px solid oklch(0.86 0.012 75)' }}
                  title="退出登录"
                >
                  <LogOut size={13} />
                  <span>退出</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden flex">
          {/* 看板主区域 */}
          <div className={`flex-1 overflow-auto transition-all duration-300 ${detailOpen ? 'w-0 min-w-0' : ''}`}>
            {effectiveActiveId === "overview" && kanbanUser.role === "admin" ? (
              <OverviewPanel
                committees={visibleCommittees}
                onSelectCommittee={(id) => {
                  setActiveCommitteeId(id);
                  setDetailOpen(false);
                }}
                onTaskClick={handleTaskClick}
                onCreateTask={(committeeId) => setQuickCreateCommitteeId(committeeId)}
              />
            ) : effectiveCommittee ? (
              <KanbanBoard
                committee={effectiveCommittee}
                onTaskClick={handleTaskClick}
                isAdmin={kanbanUser.role === "admin"}
              />
            ) : null}
          </div>

          {/* 右侧详情面板 */}
          {detailOpen && selectedTask && (
            <TaskDetail
              task={selectedTask}
              committee={visibleCommittees.find(c => c.tasks.some(t => t.id === selectedTask.id)) || null}
              onClose={handleCloseDetail}
              dbTaskId={selectedTaskDbId}
              onEdit={selectedTaskDbId ? handleEditFromDetail : undefined}
              onDelete={selectedTaskDbId ? handleCloseDetail : undefined}
            />
          )}

          {/* AI Agent 侧边栏 */}
          {showAgentPanel && (
            <AgentPanel onClose={() => setShowAgentPanel(false)} />
          )}
        </div>
      </main>

      {/* 说明书弹窗 */}
      {showGuide && <Guide onClose={() => setShowGuide(false)} isAdmin={kanbanUser.role === "admin"} />}

      {/* 账号管理弹窗（管理员专用） */}
      {showUserManager && kanbanUser.role === "admin" && (
        <UserManager onClose={() => setShowUserManager(false)} />
      )}

      {/* 周报导出弹窗 */}
      {showWeeklyReport && effectiveActiveId !== "overview" && (
        <WeeklyReport
          committeeId={effectiveActiveId}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {/* 钉钉通知配置弹窗 */}
      {showDingTalk && (
        <DingTalkNotify onClose={() => setShowDingTalk(false)} />
      )}

      {/* 快速新建任务弹窗（总览页快捷入口） */}
      {quickCreateCommitteeId && (
        <QuickCreateModal
          committeeId={quickCreateCommitteeId}
          onClose={() => setQuickCreateCommitteeId(null)}
          onSaved={() => setQuickCreateCommitteeId(null)}
        />
      )}
      {/* 从详情面板触发的编辑弹窗 */}
      {detailEditTask && detailEditCommitteeId && (
        <TaskEditor
          committeeId={detailEditCommitteeId}
          taskId={detailEditTask.id}
          initialData={detailEditTask}
          onClose={() => { setDetailEditTask(null); setDetailEditCommitteeId(""); }}
          onSaved={() => {
            setDetailEditTask(null);
            setDetailEditCommitteeId("");
            utils.tasks.listAll.invalidate();
            utils.tasks.list.invalidate();
          }}
        />
      )}
      {/* 全局内容管理弹窗（管理员专属） */}
      {showGlobalEditor && kanbanUser.role === "admin" && (
        <GlobalEditor onClose={() => setShowGlobalEditor(false)} />
      )}

      {/* 委员会任务管理弹窗（委员会成员专属） */}
      {showCommitteeEditor && kanbanUser.role === "committee" && effectiveCommittee && (
        <CommitteeEditor
          committee={effectiveCommittee}
          onClose={() => setShowCommitteeEditor(false)}
        />
      )}
    </div>
  );
}
