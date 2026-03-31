/*
 * 任务详情面板 - 纸质战情室风格
 * 右侧抽屉式展示任务完整信息：目标、策略、行动、里程碑、责任人
 * 新增：AI 项目诊断功能（基于目标/路径/里程碑/行动计划/结果导向）
 */

import { useState } from "react";
import { X, Target, Zap, Users, Trophy, AlertTriangle, CheckCircle2, Brain, Loader2 } from "lucide-react";
import type { Committee, Task } from "@/data/kanbanData";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface TaskDetailProps {
  task: Task;
  committee: Committee | null;
  onClose: () => void;
  /** 数据库任务 ID（用于 AI 诊断），如果是静态任务则为 undefined */
  dbTaskId?: string;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  "进行中": { label: "进行中", cls: "status-active" },
  "已完成": { label: "已结束", cls: "status-done" },
  "已结束": { label: "已结束", cls: "status-done" },
  "待启动": { label: "待启动", cls: "status-pending" },
  "有卡点": { label: "有卡点", cls: "status-blocked" },
};

export default function TaskDetail({ task, committee, onClose, dbTaskId }: TaskDetailProps) {
  const cfg = statusConfig[task.status];
  const committeeColor = committee?.color || "oklch(0.42 0.18 22)";

  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);

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
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-5">

          {/* 目标 */}
          <Section icon={<Target size={13} />} title="任务目标" color={committeeColor}>
            <p className="text-sm text-foreground leading-relaxed">{task.goal}</p>
          </Section>

          {/* 策略 */}
          <Section icon={<Zap size={13} />} title="执行策略" color={committeeColor}>
            <p className="text-sm text-foreground leading-relaxed">{task.strategy}</p>
          </Section>

          {/* 行动项 */}
          <Section icon={<CheckCircle2 size={13} />} title={`行动清单 (${task.actions.length}项)`} color={committeeColor}>
            <div className="space-y-2">
              {task.actions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-2.5 rounded-sm text-sm"
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
                  <span className="text-foreground leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* 里程碑 */}
          <Section icon={<Trophy size={13} />} title="关键里程碑" color="oklch(0.78 0.12 75)">
            <div
              className="p-3 rounded-sm text-sm"
              style={{
                background: 'oklch(0.97 0.04 75)',
                border: '1px solid oklch(0.82 0.10 75)',
              }}
            >
              <p className="text-foreground leading-relaxed">{task.milestone}</p>
            </div>
          </Section>

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
          <Section icon={<Users size={13} />} title="责任规划" color={committeeColor}>
            <div className="space-y-3">
              {/* 主责任人 */}
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

              {/* 协作成员 */}
              {task.contributors.length > 1 && (
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

          {/* 截止日期 & 奖金 */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-3 rounded-sm"
              style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
            >
              <div className="text-[10px] text-muted-foreground mb-1">截止日期</div>
              <div className="text-sm font-mono font-medium text-foreground">{task.deadline}</div>
            </div>
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
