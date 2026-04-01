/**
 * 委员会成员专属任务管理面板
 * 只能查看和操作本委员会的任务（增删改查）
 * 后端已做权限隔离，此处为前端便捷入口
 * 修复：新建任务保存后不关闭弹窗（可继续新建），任务状态支持内联切换
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import TaskEditor from "@/components/TaskEditor";
import { Plus, Edit2, Trash2, X, Loader2, AlertCircle, CheckCircle2, Clock, AlertTriangle, PlayCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Committee } from "@/data/kanbanData";

interface CommitteeEditorProps {
  committee: Committee;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  "进行中": { label: "进行中", color: "oklch(0.35 0.15 145)", icon: PlayCircle },
  "已完成": { label: "已结束", color: "oklch(0.55 0.01 60)", icon: CheckCircle2 },
  "已结束": { label: "已结束", color: "oklch(0.55 0.01 60)", icon: CheckCircle2 },
  "待启动": { label: "待启动", color: "oklch(0.55 0.015 60)", icon: Clock },
  "有卡点": { label: "有卡点", color: "oklch(0.55 0.18 22)", icon: AlertTriangle },
};

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

export default function CommitteeEditor({ committee, onClose }: CommitteeEditorProps) {
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("全部");
  const [statusMenuTaskId, setStatusMenuTaskId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery(
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

  const updateStatusMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ committeeId: committee.id });
      utils.tasks.listAll.invalidate();
      toast.success("状态已更新");
      setStatusMenuTaskId(null);
    },
    onError: (err) => toast.error(`更新失败：${err.message}`),
  });

  const handleDelete = (task: DbTask) => {
    if (!confirm(`确认删除任务「${task.name}」？此操作不可撤销。`)) return;
    deleteMutation.mutate({ id: task.id });
  };

  const handleStatusChange = (taskId: string, status: string) => {
    updateStatusMutation.mutate({ id: taskId, status: status as DbTask["status"] });
  };

  // 新建任务保存后：重置表单继续新建（不关闭弹窗）；编辑任务保存后：关闭弹窗
  const handleEditorSaved = () => {
    if (editingTask) {
      // 编辑模式：保存后关闭
      setShowTaskEditor(false);
      setEditingTask(null);
    } else {
      // 新建模式：保存后重置表单，允许继续新建
      setShowTaskEditor(false);
      setTimeout(() => setShowTaskEditor(true), 50);
    }
    refetch();
    utils.tasks.list.invalidate({ committeeId: committee.id });
  };

  const allStatuses = ["全部", "进行中", "有卡点", "待启动", "已完成", "已结束"];
  const filteredTasks = (tasks || []).filter(t =>
    filterStatus === "全部" || t.status === filterStatus
  );

  const statusCounts = (tasks || []).reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => { setStatusMenuTaskId(null); onClose(); }}
      />

      {/* 面板 */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl flex flex-col shadow-2xl"
        style={{ background: 'oklch(0.975 0.008 80)', borderLeft: '1px solid oklch(0.86 0.012 75)' }}
        onClick={() => setStatusMenuTaskId(null)}
      >
        {/* 标题栏 */}
        <div
          className="shrink-0 px-6 py-4 flex items-center justify-between border-b"
          style={{
            borderColor: 'oklch(0.86 0.012 75)',
            background: `${committee.color}08`,
            borderLeft: `4px solid ${committee.color}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{committee.icon}</span>
            <div>
              <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {committee.fullName} · 任务管理
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                管理本委员会的所有任务，不可访问其他委员会数据
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingTask(null); setShowTaskEditor(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-sm font-medium transition-all hover:opacity-90"
              style={{ background: committee.color, color: 'white' }}
            >
              <Plus size={13} /> 新建任务
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-sm hover:bg-black/10 transition-colors"
            >
              <X size={16} style={{ color: 'oklch(0.45 0.015 60)' }} />
            </button>
          </div>
        </div>

        {/* 统计栏 */}
        <div
          className="shrink-0 px-6 py-3 flex items-center gap-4 border-b"
          style={{ borderColor: 'oklch(0.86 0.012 75)', background: 'oklch(0.97 0.005 80)' }}
        >
          <span className="text-xs text-muted-foreground">任务统计：</span>
          {Object.entries(statusConfig).filter(([s]) => s !== "已完成").map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-1.5">
              <cfg.icon size={11} style={{ color: cfg.color }} />
              <span className="text-xs font-mono" style={{ color: cfg.color }}>
                {statusCounts[status] || 0}
              </span>
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            共 <span className="font-mono font-bold text-foreground mx-0.5">{(tasks || []).length}</span> 项任务
          </div>
        </div>

        {/* 状态筛选 */}
        <div
          className="shrink-0 px-6 py-2 flex items-center gap-2 border-b flex-wrap"
          style={{ borderColor: 'oklch(0.86 0.012 75)' }}
        >
          {allStatuses.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-2.5 py-1 text-xs rounded-sm transition-all"
              style={{
                background: filterStatus === s ? committee.color : 'oklch(0.94 0.008 75)',
                color: filterStatus === s ? 'white' : 'oklch(0.45 0.015 60)',
                border: `1px solid ${filterStatus === s ? committee.color : 'oklch(0.86 0.012 75)'}`,
              }}
            >
              {s}
              {s !== "全部" && statusCounts[s] ? ` (${statusCounts[s]})` : ""}
            </button>
          ))}
        </div>

        {/* 任务列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> 加载任务中...
            </div>
          )}

          {!isLoading && filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle size={32} className="mb-3 opacity-20" style={{ color: 'oklch(0.55 0.015 60)' }} />
              <p className="text-sm text-muted-foreground">
                {filterStatus === "全部" ? "暂无任务，点击「新建任务」开始添加" : `暂无「${filterStatus}」状态的任务`}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const cfg = statusConfig[task.status] || statusConfig["待启动"];
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={task.id}
                  className="group rounded-sm p-4 transition-all hover:shadow-md"
                  style={{
                    background: 'oklch(0.99 0.003 80)',
                    border: '1px solid oklch(0.88 0.012 75)',
                    borderLeft: `3px solid ${committee.color}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatusIcon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                        <h3
                          className="text-sm font-semibold text-foreground truncate"
                          style={{ fontFamily: "'Noto Serif SC', serif" }}
                        >
                          {task.name}
                        </h3>
                        <span
                          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                          style={{
                            background: `${cfg.color}15`,
                            color: cfg.color,
                            border: `1px solid ${cfg.color}30`,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                        {task.goal}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {task.manager && (
                          <span>负责人：<span className="text-foreground">{task.manager}</span></span>
                        )}
                        {task.deadline && (
                          <span>截止：<span className="text-foreground">{task.deadline}</span></span>
                        )}
                        {(task.completionRate ?? 0) > 0 && (
                          <span>
                            完成度：
                            <span className="font-mono font-bold" style={{ color: committee.color }}>
                              {task.completionRate}%
                            </span>
                          </span>
                        )}
                        {task.score && (
                          <span>
                            积分：
                            <span className="font-mono font-bold" style={{ color: 'oklch(0.55 0.18 75)' }}>
                              {task.score}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* 状态快速切换下拉 */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm transition-colors hover:bg-black/5"
                          style={{ color: cfg.color, border: `1px solid ${cfg.color}40` }}
                          title="切换状态"
                          disabled={updateStatusMutation.isPending}
                        >
                          <StatusIcon size={10} />
                          {cfg.label}
                          <ChevronDown size={9} />
                        </button>
                        {statusMenuTaskId === task.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-[60] rounded-sm shadow-lg py-1 min-w-[96px]"
                            style={{ background: 'oklch(0.99 0.003 80)', border: '1px solid oklch(0.86 0.012 75)' }}
                            onClick={e => e.stopPropagation()}
                          >
                            {(["进行中", "待启动", "有卡点", "已结束"] as const).filter(s => s !== task.status).map(s => {
                              const sc = statusConfig[s];
                              const SIcon = sc.icon;
                              return (
                                <button
                                  key={s}
                                  onClick={() => handleStatusChange(task.id, s)}
                                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-black/5 transition-colors"
                                  style={{ color: sc.color }}
                                >
                                  <SIcon size={10} /> {sc.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setEditingTask(task as DbTask); setShowTaskEditor(true); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm transition-colors hover:bg-black/5"
                        style={{ color: 'oklch(0.45 0.015 60)', border: '1px solid oklch(0.86 0.012 75)' }}
                        title="编辑任务"
                      >
                        <Edit2 size={11} /> 编辑
                      </button>
                      <button
                        onClick={() => handleDelete(task as DbTask)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm transition-colors hover:bg-red-50"
                        style={{ color: 'oklch(0.55 0.18 22)', border: '1px solid oklch(0.86 0.012 75)' }}
                        title="删除任务"
                      >
                        <Trash2 size={11} /> 删除
                      </button>
                    </div>
                  </div>

                  {/* 进度条 */}
                  {(task.completionRate ?? 0) > 0 && (
                    <div className="mt-3">
                      <div className="h-1 rounded-full" style={{ background: 'oklch(0.92 0.01 80)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${task.completionRate}%`, background: committee.color }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部提示 */}
        <div
          className="shrink-0 px-6 py-3 border-t text-xs text-muted-foreground flex items-center gap-2"
          style={{ borderColor: 'oklch(0.86 0.012 75)', background: 'oklch(0.97 0.005 80)' }}
        >
          <AlertCircle size={11} />
          <span>权限说明：您只能管理「{committee.fullName}」的任务，无法访问其他委员会数据</span>
        </div>
      </div>

      {/* 任务编辑器 */}
      {showTaskEditor && (
        <TaskEditor
          committeeId={committee.id}
          taskId={editingTask?.id}
          initialData={editingTask ? {
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
          } : undefined}
          onClose={() => { setShowTaskEditor(false); setEditingTask(null); }}
          onSaved={handleEditorSaved}
        />
      )}
    </>
  );
}
