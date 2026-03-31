/**
 * 积分奖金汇总面板
 * 展示委员会或全局的积分排行、奖金核算、投入产出比
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Sparkles, Trophy, TrendingUp, DollarSign, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { committees as staticCommittees } from "@/data/kanbanData";

interface ScorePanelProps {
  committeeId: string; // "overview" 表示全局
  isAdmin: boolean;
}

export default function ScorePanel({ committeeId, isAdmin }: ScorePanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const targetId = committeeId === "overview" ? "all" : committeeId;

  // 获取所有任务（管理员）或委员会任务
  const { data: allTasks, isLoading: tasksLoading } = trpc.tasks.listAll.useQuery(
    undefined,
    { enabled: isAdmin && committeeId === "overview" }
  );

  const { data: committeeTasks, isLoading: committeeTasksLoading } = trpc.tasks.list.useQuery(
    { committeeId },
    { enabled: committeeId !== "overview" }
  );

  const tasks = committeeId === "overview" ? (allTasks || []) : (committeeTasks || []);
  const isLoading = tasksLoading || committeeTasksLoading;

  // 计算统计数据
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "已结束" || t.status === "已完成").length;
  const inProgressTasks = tasks.filter(t => t.status === "进行中").length;
  const blockedTasks = tasks.filter(t => t.status === "有卡点").length;
  const avgCompletion = totalTasks > 0
    ? tasks.reduce((sum, t) => sum + (t.completionRate || 0), 0) / totalTasks
    : 0;
  const totalScore = tasks.reduce((sum, t) => sum + (t.score || 0), 0);
  const avgScore = totalTasks > 0 ? totalScore / totalTasks : 0;

  // 按委员会分组（全局视图）
  const committeeStats = committeeId === "overview"
    ? staticCommittees.map(c => {
        const cTasks = tasks.filter(t => t.committeeId === c.id);
        const cCompleted = cTasks.filter(t => t.status === "已结束" || t.status === "已完成").length;
        const cAvgCompletion = cTasks.length > 0
          ? cTasks.reduce((sum, t) => sum + (t.completionRate || 0), 0) / cTasks.length
          : 0;
        const cScore = cTasks.reduce((sum, t) => sum + (t.score || 0), 0);
        return {
          id: c.id,
          name: c.shortName,
          color: c.color,
          total: cTasks.length,
          completed: cCompleted,
          avgCompletion: cAvgCompletion,
          totalScore: cScore,
        };
      }).filter(c => c.total > 0).sort((a, b) => b.totalScore - a.totalScore)
    : [];

  // 积分最高的任务 Top 5
  const topTasks = [...tasks]
    .filter(t => t.score && t.score > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: 'oklch(0.42 0.18 22)' }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'oklch(0.42 0.18 22)' }} />
          <h2 className="text-base font-bold" style={{ fontFamily: "'Noto Serif SC', serif", color: 'oklch(0.22 0.015 60)' }}>
            {committeeId === "overview" ? "全局积分总览" : "委员会积分核算"}
          </h2>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm hover:bg-black/5 transition-colors"
          style={{ border: '1px solid oklch(0.88 0.012 75)', color: 'oklch(0.55 0.015 60)' }}
        >
          <RefreshCw size={11} /> 刷新
        </button>
      </div>

      {/* 核心指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={BarChart3} label="任务总数" value={totalTasks} color="oklch(0.45 0.15 250)" />
        <MetricCard icon={Trophy} label="已结束" value={completedTasks} color="oklch(0.55 0.18 145)" />
        <MetricCard icon={TrendingUp} label="平均完成度" value={`${avgCompletion.toFixed(0)}%`} color="oklch(0.55 0.18 60)" />
        <MetricCard icon={Sparkles} label="平均积分" value={avgScore.toFixed(1)} color="oklch(0.42 0.18 22)" />
      </div>

      {/* 状态分布 */}
      <div className="p-4 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
        <h3 className="text-xs font-semibold mb-3" style={{ color: 'oklch(0.45 0.015 60)' }}>任务状态分布</h3>
        <div className="space-y-2">
          {[
            { label: "进行中", count: inProgressTasks, color: "oklch(0.55 0.18 145)" },
            { label: "已结束", count: completedTasks, color: "oklch(0.45 0.15 250)" },
            { label: "待启动", count: tasks.filter(t => t.status === "待启动").length, color: "oklch(0.65 0.015 60)" },
            { label: "有卡点", count: blockedTasks, color: "oklch(0.55 0.18 22)" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs w-12" style={{ color: 'oklch(0.55 0.015 60)' }}>{label}</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'oklch(0.93 0.01 80)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: totalTasks > 0 ? `${(count / totalTasks) * 100}%` : '0%', background: color }}
                />
              </div>
              <span className="text-xs font-mono w-6 text-right" style={{ color: 'oklch(0.45 0.015 60)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 委员会积分排行（全局视图） */}
      {committeeId === "overview" && committeeStats.length > 0 && (
        <div className="p-4 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'oklch(0.45 0.015 60)' }}>
            <Trophy size={12} /> 委员会积分排行
          </h3>
          <div className="space-y-2">
            {committeeStats.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-xs font-bold w-4" style={{ color: idx < 3 ? 'oklch(0.42 0.18 22)' : 'oklch(0.65 0.015 60)' }}>
                  {idx + 1}
                </span>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-xs flex-1 truncate" style={{ color: 'oklch(0.35 0.015 60)' }}>{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>{c.avgCompletion.toFixed(0)}%</span>
                  <span className="text-xs font-bold" style={{ color: 'oklch(0.42 0.18 22)' }}>
                    {c.totalScore > 0 ? c.totalScore.toFixed(0) + "分" : "待核算"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 积分 Top 任务 */}
      {topTasks.length > 0 && (
        <div className="p-4 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'oklch(0.45 0.015 60)' }}>
            <Sparkles size={12} /> 积分最高任务 Top {topTasks.length}
          </h3>
          <div className="space-y-2">
            {topTasks.map((task, idx) => (
              <div key={task.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: idx < topTasks.length - 1 ? '1px solid oklch(0.93 0.01 80)' : 'none' }}>
                <span className="text-xs font-bold w-4" style={{ color: 'oklch(0.42 0.18 22)' }}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'oklch(0.35 0.015 60)' }}>{task.name}</p>
                  <p className="text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>{task.committeeId} · {task.status}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: 'oklch(0.42 0.18 22)' }}>
                  {(task.score || 0).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topTasks.length === 0 && (
        <div className="p-6 text-center rounded-sm" style={{ border: '1px dashed oklch(0.82 0.012 75)', color: 'oklch(0.65 0.015 60)' }}>
          <Sparkles size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无积分数据</p>
          <p className="text-xs mt-1">在任务详情中点击「AI 核算积分」开始评分</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="p-3 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} style={{ color }} />
        <span className="text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color, fontFamily: "'Noto Serif SC', serif" }}>{value}</p>
    </div>
  );
}
