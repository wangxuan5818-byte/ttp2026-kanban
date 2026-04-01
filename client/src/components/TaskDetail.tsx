/*
 * 任务详情面板 - 纸质战情室风格
 * 右侧抽屉式展示任务完整信息：目标、策略、行动、里程碑、责任人
 * 新增：编辑/删除按钮、结构化时间节点展示、AI 项目诊断功能
 * 修复：行动清单支持增删改查（dbTaskId存在时）
 */

import { useState } from "react";
import {
  X, Target, Zap, Users, Trophy, AlertTriangle, CheckCircle2,
  Brain, Loader2, Pencil, Trash2, Calendar, Clock, Plus, Edit3, Save, XCircle
} from "lucide-react";
import type { Committee, Task } from "@/data/kanbanData";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface TaskDetailProps {
  task: Task;
  committee: Committee | null;
  onClose: () => void;
  /** 数据库任务 ID（用于 AI 诊断/编辑/删除），如果是静态任务则为 undefined */
  dbTaskId?: string;
  /** 编辑回调 */
  onEdit?: () => void;
  /** 删除回调 */
  onDelete?: () => void;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  "进行中": { label: "进行中", cls: "status-active" },
  "已完成": { label: "已结束", cls: "status-done" },
  "已结束": { label: "已结束", cls: "status-done" },
  "待启动": { label: "待启动", cls: "status-pending" },
  "有卡点": { label: "有卡点", cls: "status-blocked" },
};

/** 解析里程碑文本为结构化节点列表 */
function parseMilestones(text: string): Array<{ date: string; desc: string }> {
  if (!text) return [];
  const lines = text.split(/[；;,，\n]/).map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    const dateMatch = line.match(/^(\d{4}[-/年]\d{1,2}[-/月]\d{0,2}日?|[一二三四五六七八九十\d]+月[一二三四五六七八九十\d]+日?|\d{1,2}[./-]\d{1,2})\s*[：:]\s*(.+)$/);
    if (dateMatch) {
      return { date: dateMatch[1], desc: dateMatch[2] };
    }
    const parenMatch = line.match(/^(.+?)（(\d{4}[-/]\d{1,2}[-/]\d{1,2})）$/);
    if (parenMatch) {
      return { date: parenMatch[2], desc: parenMatch[1] };
    }
    return { date: "", desc: line };
  });
}

export default function TaskDetail({ task, committee, onClose, dbTaskId, onEdit, onDelete }: TaskDetailProps) {
  const cfg = statusConfig[task.status] || { label: task.status, cls: "status-pending" };
  const committeeColor = committee?.color || "oklch(0.42 0.18 22)";

  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 行动清单增删改查状态
  const [localActions, setLocalActions] = useState<string[] | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingVal, setEditingVal] = useState("");
  const [addingAction, setAddingAction] = useState(false);
  const [newActionVal, setNewActionVal] = useState("");

  const utils = trpc.useUtils();

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("任务已删除");
      utils.tasks.list.invalidate();
      utils.tasks.listAll.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(`删除失败：${err.message}`);
    },
  });

  const updateActionsMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      utils.tasks.listAll.invalidate();
      toast.success("行动清单已更新");
      setEditingIdx(null);
      setAddingAction(false);
      setNewActionVal("");
    },
    onError: (err) => toast.error(`更新失败：${err.message}`),
  });

  const diagnoseMutation = trpc.tasks.diagnose.useMutation({
    onSuccess: (data) => {
      setDiagnosisResult(data.diagnosis);
      setShowDiagnosis(true);
    },
    onError: (err) => {
      toast.error(`AI 诊断失败：${err.message}`);
    },
  });

  const handleDiagnose = () => {
    if (!dbTaskId) {
      toast.error("该任务暂不支持 AI 诊断（需先同步到数据库）");
      return;
    }
    if (diagnoseMutation.isPending) return;
    diagnoseMutation.mutate({
      committeeId: committee?.id || "",
      taskId: dbTaskId,
    });
  };

  const handleDelete = () => {
    if (!dbTaskId) {
      toast.error("该任务暂不支持删除（静态任务）");
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteMutation.mutate({ id: dbTaskId });
  };

  // 行动清单操作
  const currentActions = localActions !== null ? localActions : (task.actions || []);

  const saveActions = (newActions: string[]) => {
    if (!dbTaskId) return;
    setLocalActions(newActions);
    updateActionsMutation.mutate({ id: dbTaskId, actions: newActions.filter(a => a.trim()) });
  };

  const handleAddAction = () => {
    if (!newActionVal.trim()) return;
    saveActions([...currentActions, newActionVal.trim()]);
  };

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingVal(currentActions[idx]);
  };

  const handleSaveEdit = (idx: number) => {
    if (!editingVal.trim()) return;
    const updated = currentActions.map((a, i) => i === idx ? editingVal.trim() : a);
    saveActions(updated);
  };

  const handleDeleteAction = (idx: number) => {
    saveActions(currentActions.filter((_, i) => i !== idx));
  };

  const milestones = parseMilestones(task.milestone || "");

  return (
    <>
      <div
        className="w-96 shrink-0 h-full border-l border-border overflow-y-auto animate-slide-in-left"
        style={{ background: 'oklch(0.99 0.004 80)' }}
      >
        {/* 头部 */}
        <div
          className="sticky top-0 z-10 px-5 py-4 border-b border-border"
          style={{ background: 'oklch(0.99 0.004 80)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {committee && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                    style={{ background: `${committeeColor}15`, color: committeeColor }}
                  >
                    {committee.shortName}
                  </span>
                )}
                <span className={`${cfg.cls} text-[10px] px-1.5 py-0.5 rounded-sm font-medium`}>
                  {cfg.label}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground leading-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                {task.name}
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* AI 诊断按钮 */}
              <button
                onClick={handleDiagnose}
                disabled={diagnoseMutation.isPending || !dbTaskId}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] rounded-sm font-medium transition-all disabled:opacity-40"
                style={{
                  background: 'oklch(0.35 0.12 200)',
                  color: 'oklch(0.98 0.002 60)',
                  opacity: !dbTaskId ? 0.4 : 1,
                }}
                title={dbTaskId ? "AI 项目诊断" : "该任务暂不支持 AI 诊断"}
              >
                {diagnoseMutation.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Brain size={11} />
                )}
                {diagnoseMutation.isPending ? "诊断中…" : "AI 诊断"}
              </button>
              {/* 编辑按钮 */}
              {onEdit && dbTaskId && (
                <button
                  onClick={onEdit}
                  className="w-7 h-7 rounded-sm flex items-center justify-center transition-colors hover:bg-muted"
                  title="编辑任务"
                  style={{ color: 'oklch(0.45 0.12 250)' }}
                >
                  <Pencil size={13} />
                </button>
              )}
              {/* 删除按钮 */}
              {onDelete && dbTaskId && (
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="w-7 h-7 rounded-sm flex items-center justify-center transition-colors"
                  title={confirmDelete ? "再次点击确认删除" : "删除任务"}
                  style={{
                    color: confirmDelete ? 'oklch(0.98 0.002 60)' : 'oklch(0.42 0.18 22)',
                    background: confirmDelete ? 'oklch(0.42 0.18 22)' : 'transparent',
                  }}
                >
                  {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {/* 删除确认提示 */}
          {confirmDelete && (
            <div className="mt-2 text-[10px] text-center py-1 rounded-sm" style={{ background: 'oklch(0.97 0.04 22)', color: 'oklch(0.42 0.18 22)', border: '1px solid oklch(0.80 0.12 22)' }}>
              再次点击删除按钮确认删除（3秒内有效）
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-5">

          {/* 目标 */}
          {task.goal && (
            <Section icon={<Target size={13} />} title="任务目标" color={committeeColor}>
              <p className="text-sm text-foreground leading-relaxed">{task.goal}</p>
            </Section>
          )}

          {/* 策略 */}
          {task.strategy && (
            <Section icon={<Zap size={13} />} title="执行策略" color={committeeColor}>
              <p className="text-sm text-foreground leading-relaxed">{task.strategy}</p>
            </Section>
          )}

          {/* 行动清单 - 支持增删改查 */}
          <Section
            icon={<CheckCircle2 size={13} />}
            title={`行动清单 (${currentActions.length}项)`}
            color={committeeColor}
          >
            <div className="space-y-2">
              {currentActions.length === 0 && !addingAction && (
                <div
                  className="text-xs text-muted-foreground py-3 text-center rounded-sm"
                  style={{ border: '1px dashed oklch(0.86 0.012 75)' }}
                >
                  暂无行动项{dbTaskId ? "，点击下方按钮添加" : ""}
                </div>
              )}
              {currentActions.map((action, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-2.5 p-2.5 rounded-sm text-sm"
                  style={{
                    background: 'oklch(0.97 0.004 80)',
                    border: '1px solid oklch(0.90 0.008 75)',
                  }}
                >
                  <span
                    className="shrink-0 w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold mt-0.5"
                    style={{ background: committeeColor, color: 'oklch(0.98 0.002 60)' }}
                  >
                    {i + 1}
                  </span>
                  {editingIdx === i ? (
                    <div className="flex-1 flex gap-1.5">
                      <input
                        value={editingVal}
                        onChange={e => setEditingVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(i);
                          if (e.key === 'Escape') setEditingIdx(null);
                        }}
                        autoFocus
                        className="flex-1 px-2 py-0.5 text-sm rounded-sm outline-none"
                        style={{ border: `1px solid ${committeeColor}60`, background: 'white' }}
                      />
                      <button
                        onClick={() => handleSaveEdit(i)}
                        disabled={updateActionsMutation.isPending}
                        className="p-1 rounded-sm hover:bg-green-50"
                        title="保存"
                      >
                        {updateActionsMutation.isPending ? <Loader2 size={12} className="animate-spin" style={{ color: 'oklch(0.35 0.15 145)' }} /> : <Save size={12} style={{ color: 'oklch(0.35 0.15 145)' }} />}
                      </button>
                      <button onClick={() => setEditingIdx(null)} className="p-1 rounded-sm hover:bg-black/5" title="取消">
                        <XCircle size={12} style={{ color: 'oklch(0.55 0.015 60)' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-foreground leading-relaxed">{action}</span>
                      {dbTaskId && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                          <button
                            onClick={() => handleStartEdit(i)}
                            className="p-1 rounded-sm hover:bg-black/5"
                            title="编辑"
                          >
                            <Edit3 size={11} style={{ color: 'oklch(0.45 0.015 60)' }} />
                          </button>
                          <button
                            onClick={() => handleDeleteAction(i)}
                            disabled={updateActionsMutation.isPending}
                            className="p-1 rounded-sm hover:bg-red-50"
                            title="删除"
                          >
                            <Trash2 size={11} style={{ color: 'oklch(0.55 0.18 22)' }} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {/* 新增行动项输入框 */}
              {addingAction ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={newActionVal}
                    onChange={e => setNewActionVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddAction();
                      if (e.key === 'Escape') { setAddingAction(false); setNewActionVal(""); }
                    }}
                    autoFocus
                    placeholder="输入行动项内容..."
                    className="flex-1 px-2 py-1.5 text-sm rounded-sm outline-none"
                    style={{ border: `1px solid ${committeeColor}60`, background: 'white' }}
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={updateActionsMutation.isPending || !newActionVal.trim()}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-sm font-medium disabled:opacity-50"
                    style={{ background: committeeColor, color: 'white' }}
                  >
                    {updateActionsMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    保存
                  </button>
                  <button
                    onClick={() => { setAddingAction(false); setNewActionVal(""); }}
                    className="p-1.5 rounded-sm hover:bg-black/5"
                  >
                    <XCircle size={14} style={{ color: 'oklch(0.55 0.015 60)' }} />
                  </button>
                </div>
              ) : dbTaskId ? (
                <button
                  onClick={() => setAddingAction(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm transition-colors w-full justify-center"
                  style={{ border: '1px dashed oklch(0.75 0.015 75)', color: 'oklch(0.55 0.015 60)' }}
                >
                  <Plus size={12} /> 添加行动项
                </button>
              ) : null}
            </div>
          </Section>

          {/* 里程碑 / 时间节点 */}
          {task.milestone && (
            <Section icon={<Trophy size={13} />} title="关键里程碑" color="oklch(0.78 0.12 75)">
              {milestones.length > 1 ? (
                <div className="space-y-2">
                  {milestones.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-2.5 rounded-sm"
                      style={{
                        background: 'oklch(0.97 0.04 75)',
                        border: '1px solid oklch(0.82 0.10 75)',
                      }}
                    >
                      <span
                        className="shrink-0 w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold mt-0.5"
                        style={{ background: 'oklch(0.78 0.12 75)', color: 'white' }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {m.date && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <Calendar size={9} style={{ color: 'oklch(0.55 0.10 75)' }} />
                            <span className="text-[10px] font-mono font-medium" style={{ color: 'oklch(0.45 0.12 75)' }}>{m.date}</span>
                          </div>
                        )}
                        <p className="text-sm text-foreground leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="p-3 rounded-sm text-sm"
                  style={{
                    background: 'oklch(0.97 0.04 75)',
                    border: '1px solid oklch(0.82 0.10 75)',
                  }}
                >
                  <p className="text-foreground leading-relaxed">{task.milestone}</p>
                </div>
              )}
            </Section>
          )}

          {/* 当前结果 */}
          {task.result && (
            <Section icon={<CheckCircle2 size={13} />} title="当前进展" color="oklch(0.35 0.15 145)">
              <div
                className="p-3 rounded-sm text-sm"
                style={{
                  background: 'oklch(0.96 0.04 145)',
                  border: '1px solid oklch(0.80 0.10 145)',
                }}
              >
                <p className="text-foreground leading-relaxed">{task.result}</p>
              </div>
            </Section>
          )}

          {/* 突破点 */}
          {task.breakthrough && (
            <Section icon={<AlertTriangle size={13} />} title="需要突破的能力" color={task.status === "有卡点" ? "oklch(0.42 0.18 22)" : "oklch(0.52 0.02 60)"}>
              <div
                className="p-3 rounded-sm text-sm"
                style={{
                  background: task.status === "有卡点" ? 'oklch(0.97 0.04 22)' : 'oklch(0.97 0.004 80)',
                  border: `1px solid ${task.status === "有卡点" ? 'oklch(0.80 0.12 22)' : 'oklch(0.86 0.012 75)'}`,
                }}
              >
                <p className="text-foreground leading-relaxed">{task.breakthrough}</p>
              </div>
            </Section>
          )}

          {/* 责任规划 */}
          {(task.manager || (task.contributors && task.contributors.length > 0)) && (
            <Section icon={<Users size={13} />} title="责任规划" color={committeeColor}>
              <div className="space-y-3">
                {/* 主责任人 */}
                {task.manager && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1.5 font-medium tracking-wide">主责任人</div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-sm flex items-center justify-center text-sm font-bold"
                        style={{ background: committeeColor, color: 'oklch(0.98 0.002 60)' }}
                      >
                        {task.manager.slice(-1)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{task.manager}</div>
                        <div className="text-[10px] text-muted-foreground">负责人</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 协作成员 */}
                {task.contributors && task.contributors.length > 1 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1.5 font-medium tracking-wide">协作成员</div>
                    <div className="flex flex-wrap gap-2">
                      {task.contributors.filter(c => c !== task.manager).map((member, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div
                            className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold"
                            style={{ background: `${committeeColor}20`, color: committeeColor }}
                          >
                            {member.slice(-1)}
                          </div>
                          <span className="text-xs text-foreground">{member}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 截止日期 & 奖金 */}
          <div className="grid grid-cols-2 gap-3">
            {task.deadline && (
              <div
                className="p-3 rounded-sm"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
              >
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <Clock size={9} />
                  截止日期
                </div>
                <div className="text-sm font-mono font-medium text-foreground">{task.deadline}</div>
              </div>
            )}
            {task.rewardPool && (
              <div
                className="p-3 rounded-sm"
                style={{ background: 'oklch(0.97 0.04 75)', border: '1px solid oklch(0.82 0.10 75)' }}
              >
                <div className="text-[10px] mb-1" style={{ color: 'oklch(0.45 0.12 75)' }}>奖金机制</div>
                <div className="text-xs text-foreground leading-relaxed">{task.rewardPool}</div>
              </div>
            )}
          </div>

          {/* 底部操作区 */}
          {dbTaskId && (
            <div className="flex gap-2 pt-2 border-t border-border">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-sm font-medium transition-colors"
                  style={{ background: `${committeeColor}15`, color: committeeColor, border: `1px solid ${committeeColor}30` }}
                >
                  <Pencil size={11} />
                  编辑任务
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: confirmDelete ? 'oklch(0.42 0.18 22)' : 'oklch(0.97 0.004 80)',
                    color: confirmDelete ? 'white' : 'oklch(0.42 0.18 22)',
                    border: '1px solid oklch(0.80 0.12 22)',
                  }}
                >
                  {deleteMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  {confirmDelete ? "确认删除" : "删除"}
                </button>
              )}
            </div>
          )}

          {/* AI 诊断提示（无 dbTaskId 时） */}
          {!dbTaskId && (
            <div
              className="p-3 rounded-sm text-xs"
              style={{ background: 'oklch(0.97 0.004 80)', border: '1px dashed oklch(0.86 0.012 75)' }}
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Brain size={11} />
                <span>AI 诊断功能需要任务已同步至数据库。请通过委员会看板创建或编辑任务后使用。</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* AI 诊断结果弹窗 */}
      {showDiagnosis && diagnosisResult && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDiagnosis(false); }}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col rounded-sm shadow-2xl"
            style={{ background: 'oklch(0.975 0.008 80)', border: '1px solid oklch(0.86 0.012 75)' }}
          >
            {/* 弹窗头部 */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ background: 'oklch(0.18 0.02 22)', borderBottom: '1px solid oklch(0.86 0.012 75)' }}
            >
              <div className="flex items-center gap-3">
                <Brain size={18} style={{ color: 'oklch(0.78 0.10 200)' }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'oklch(0.975 0.008 80)', fontFamily: "'Noto Serif SC', serif" }}>
                    AI 项目诊断报告
                  </h2>
                  <p className="text-[10px]" style={{ color: 'oklch(0.65 0.015 60)' }}>
                    {task.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosis(false)}
                className="p-1.5 rounded-sm hover:bg-white/10 transition-colors"
              >
                <X size={16} style={{ color: 'oklch(0.78 0.10 75)' }} />
              </button>
            </div>
            {/* 诊断内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div
                className="prose prose-sm max-w-none text-foreground"
                style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
              >
                <Streamdown>{diagnosisResult}</Streamdown>
              </div>
            </div>
            {/* 底部操作 */}
            <div
              className="px-6 py-4 flex items-center justify-between shrink-0"
              style={{ borderTop: '1px solid oklch(0.86 0.012 75)' }}
            >
              <button
                onClick={handleDiagnose}
                disabled={diagnoseMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                {diagnoseMutation.isPending ? (
                  <><Loader2 size={11} className="animate-spin" /> 重新诊断中…</>
                ) : (
                  <><Brain size={11} /> 重新诊断</>
                )}
              </button>
              <button
                onClick={() => setShowDiagnosis(false)}
                className="px-4 py-1.5 text-xs rounded-sm font-medium"
                style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 区块标题组件
function Section({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span style={{ color }}>{icon}</span>
        <h4 className="text-xs font-semibold text-foreground tracking-wide" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
