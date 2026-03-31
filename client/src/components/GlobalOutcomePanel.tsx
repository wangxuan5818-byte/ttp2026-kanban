/*
 * 全局效益汇总面板（管理员专用）
 * 展示各部门效益对比、综合年化价值、ROI排行
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, TrendingDown, Zap, Award, BarChart2, Target, DollarSign } from "lucide-react";
import { committees as staticCommittees } from "@/data/kanbanData";

const TYPE_COLORS = {
  提效: "oklch(0.45 0.18 200)",
  降本: "oklch(0.42 0.16 145)",
  增收: "oklch(0.42 0.18 22)",
};

function calcTotalValue(tiXiao: number, jiangBen: number, zengShou: number): number {
  return tiXiao * 300 / 8 / 10000 + jiangBen / 10000 + zengShou;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 rounded-sm overflow-hidden" style={{ background: "oklch(0.92 0.008 75)" }}>
      <div
        className="h-full rounded-sm transition-all duration-500"
        style={{ width: `${pct}%`, background: color, opacity: 0.85 }}
      />
    </div>
  );
}

export default function GlobalOutcomePanel() {
  const { data: globalData, isLoading } = trpc.outcomes.globalSummary.useQuery(undefined, {
    retry: false,
  });

  const deptRows = useMemo(() => {
    if (!globalData) return [];
    return staticCommittees
      .map(c => {
        const d = globalData[c.id] || { 提效: 0, 降本: 0, 增收: 0, count: 0 };
        const totalVal = calcTotalValue(d.提效, d.降本, d.增收);
        return { ...c, ...d, totalVal };
      })
      .filter(r => r.count > 0)
      .sort((a, b) => b.totalVal - a.totalVal);
  }, [globalData]);

  const totals = useMemo(() => {
    if (!deptRows.length) return { 提效: 0, 降本: 0, 增收: 0, totalVal: 0, count: 0 };
    return deptRows.reduce(
      (acc, r) => ({
        提效: acc.提效 + r.提效,
        降本: acc.降本 + r.降本,
        增收: acc.增收 + r.增收,
        totalVal: acc.totalVal + r.totalVal,
        count: acc.count + r.count,
      }),
      { 提效: 0, 降本: 0, 增收: 0, totalVal: 0, count: 0 }
    );
  }, [deptRows]);

  const maxVal = useMemo(() => Math.max(...deptRows.map(r => r.totalVal), 1), [deptRows]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-sm" style={{ color: "oklch(0.55 0.015 60)" }}>
        <Loader2 size={14} className="animate-spin" /> 加载全局效益数据中...
      </div>
    );
  }

  if (!globalData || deptRows.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
        <div>暂无效益数据</div>
        <div className="text-xs mt-1 opacity-60">各部门在任务详情中录入效益数据后，将在此处汇总展示</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 全局汇总卡片 */}
      <div
        className="rounded-sm p-4"
        style={{ background: "oklch(0.14 0.012 60)", border: "1px solid oklch(0.28 0.015 60)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Award size={14} style={{ color: "oklch(0.78 0.12 75)" }} />
          <span className="text-xs font-semibold" style={{ color: "oklch(0.88 0.008 75)", fontFamily: "'Noto Serif SC', serif" }}>
            集团AI效益综合汇总
          </span>
          <span className="ml-auto text-[10px]" style={{ color: "oklch(0.55 0.02 60)" }}>
            {totals.count} 条效益记录 · {deptRows.length} 个部门
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-sm p-2.5 text-center" style={{ background: "oklch(0.20 0.015 60)", border: "1px solid oklch(0.32 0.015 60)" }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign size={11} style={{ color: "oklch(0.78 0.12 75)" }} />
              <span className="text-[10px]" style={{ color: "oklch(0.65 0.015 60)" }}>综合年化价值</span>
            </div>
            <div className="text-xl font-bold font-mono" style={{ color: "oklch(0.78 0.12 75)" }}>
              ¥{totals.totalVal.toFixed(1)}万
            </div>
          </div>
          <div className="rounded-sm p-2.5 text-center" style={{ background: "oklch(0.20 0.015 60)", border: "1px solid oklch(0.32 0.015 60)" }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap size={11} style={{ color: TYPE_COLORS.提效 }} />
              <span className="text-[10px]" style={{ color: "oklch(0.65 0.015 60)" }}>年化节省工时</span>
            </div>
            <div className="text-xl font-bold font-mono" style={{ color: TYPE_COLORS.提效 }}>
              {totals.提效.toFixed(0)}h
            </div>
          </div>
          <div className="rounded-sm p-2.5 text-center" style={{ background: "oklch(0.20 0.015 60)", border: "1px solid oklch(0.32 0.015 60)" }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown size={11} style={{ color: TYPE_COLORS.降本 }} />
              <span className="text-[10px]" style={{ color: "oklch(0.65 0.015 60)" }}>年化降本</span>
            </div>
            <div className="text-xl font-bold font-mono" style={{ color: TYPE_COLORS.降本 }}>
              ¥{(totals.降本 / 10000).toFixed(1)}万
            </div>
          </div>
          <div className="rounded-sm p-2.5 text-center" style={{ background: "oklch(0.20 0.015 60)", border: "1px solid oklch(0.32 0.015 60)" }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={11} style={{ color: TYPE_COLORS.增收 }} />
              <span className="text-[10px]" style={{ color: "oklch(0.65 0.015 60)" }}>年化增收</span>
            </div>
            <div className="text-xl font-bold font-mono" style={{ color: TYPE_COLORS.增收 }}>
              ¥{totals.增收.toFixed(1)}万
            </div>
          </div>
        </div>
      </div>

      {/* 部门效益排行 */}
      <div
        className="rounded-sm p-4"
        style={{ background: "oklch(0.99 0.003 80)", border: "1px solid oklch(0.90 0.008 75)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} style={{ color: "oklch(0.42 0.18 22)" }} />
          <span className="text-xs font-semibold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            各部门效益排行（按综合年化价值）
          </span>
        </div>

        <div className="space-y-3">
          {deptRows.map((dept, idx) => (
            <div key={dept.id} className="space-y-1.5">
              {/* 部门标题行 */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold font-mono w-5 text-center"
                  style={{ color: idx === 0 ? "oklch(0.42 0.18 22)" : idx === 1 ? "oklch(0.55 0.08 60)" : "oklch(0.65 0.015 60)" }}
                >
                  #{idx + 1}
                </span>
                <span className="text-sm">{dept.icon}</span>
                <span className="text-xs font-medium">{dept.shortName}</span>
                <span className="text-[10px] text-muted-foreground">{dept.count}条记录</span>
                <div className="flex-1" />
                <span className="text-sm font-bold font-mono" style={{ color: "oklch(0.42 0.18 22)" }}>
                  ¥{dept.totalVal.toFixed(2)}万
                </span>
              </div>

              {/* 综合价值进度条 */}
              <div className="flex items-center gap-2 pl-7">
                <MiniBar value={dept.totalVal} max={maxVal} color={dept.color} />
              </div>

              {/* 三类效益细分 */}
              <div className="grid grid-cols-3 gap-2 pl-7">
                <div className="flex items-center gap-1.5">
                  <Zap size={9} style={{ color: TYPE_COLORS.提效 }} />
                  <span className="text-[10px] text-muted-foreground">提效</span>
                  <span className="text-[10px] font-mono ml-auto" style={{ color: TYPE_COLORS.提效 }}>
                    {dept.提效.toFixed(0)}h
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={9} style={{ color: TYPE_COLORS.降本 }} />
                  <span className="text-[10px] text-muted-foreground">降本</span>
                  <span className="text-[10px] font-mono ml-auto" style={{ color: TYPE_COLORS.降本 }}>
                    ¥{(dept.降本 / 10000).toFixed(1)}万
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={9} style={{ color: TYPE_COLORS.增收 }} />
                  <span className="text-[10px] text-muted-foreground">增收</span>
                  <span className="text-[10px] font-mono ml-auto" style={{ color: TYPE_COLORS.增收 }}>
                    ¥{dept.增收.toFixed(1)}万
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 效益类型占比分析 */}
      <div
        className="rounded-sm p-4"
        style={{ background: "oklch(0.99 0.003 80)", border: "1px solid oklch(0.90 0.008 75)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} style={{ color: "oklch(0.45 0.18 200)" }} />
          <span className="text-xs font-semibold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            效益类型占比分析
          </span>
        </div>

        {/* 横向堆叠条 */}
        {(() => {
          const tiXiaoVal = totals.提效 * 300 / 8 / 10000;
          const jiangBenVal = totals.降本 / 10000;
          const zengShouVal = totals.增收;
          const total = tiXiaoVal + jiangBenVal + zengShouVal || 1;
          const tiXiaoPct = (tiXiaoVal / total * 100).toFixed(0);
          const jiangBenPct = (jiangBenVal / total * 100).toFixed(0);
          const zengShouPct = (zengShouVal / total * 100).toFixed(0);
          return (
            <div className="space-y-3">
              <div className="flex h-6 rounded-sm overflow-hidden gap-0.5">
                {tiXiaoVal > 0 && (
                  <div
                    className="flex items-center justify-center text-[9px] text-white font-medium transition-all"
                    style={{ width: `${tiXiaoPct}%`, background: TYPE_COLORS.提效, minWidth: "24px" }}
                  >
                    {tiXiaoPct}%
                  </div>
                )}
                {jiangBenVal > 0 && (
                  <div
                    className="flex items-center justify-center text-[9px] text-white font-medium transition-all"
                    style={{ width: `${jiangBenPct}%`, background: TYPE_COLORS.降本, minWidth: "24px" }}
                  >
                    {jiangBenPct}%
                  </div>
                )}
                {zengShouVal > 0 && (
                  <div
                    className="flex items-center justify-center text-[9px] text-white font-medium transition-all"
                    style={{ width: `${zengShouPct}%`, background: TYPE_COLORS.增收, minWidth: "24px" }}
                  >
                    {zengShouPct}%
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TYPE_COLORS.提效 }} />
                  <span className="text-muted-foreground">提效折算</span>
                  <span className="font-mono font-medium" style={{ color: TYPE_COLORS.提效 }}>¥{tiXiaoVal.toFixed(1)}万</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TYPE_COLORS.降本 }} />
                  <span className="text-muted-foreground">降本</span>
                  <span className="font-mono font-medium" style={{ color: TYPE_COLORS.降本 }}>¥{jiangBenVal.toFixed(1)}万</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TYPE_COLORS.增收 }} />
                  <span className="text-muted-foreground">增收</span>
                  <span className="font-mono font-medium" style={{ color: TYPE_COLORS.增收 }}>¥{zengShouVal.toFixed(1)}万</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
