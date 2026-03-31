/*
 * 效益核算面板 - AI介入前后对比（详细版）
 * 支持三类效益录入：提效 / 降本 / 增收
 * 新增：ROI分析、趋势图、综合评估、效益雷达图
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronRight,
  Loader2, TrendingUp, TrendingDown, Zap, BarChart2,
  Target, Award, AlertCircle, CheckCircle, Clock,
  DollarSign, Activity, Info
} from "lucide-react";

type OutcomeType = "提效" | "降本" | "增收";

interface OutcomePanelProps {
  committeeId: string;
  taskId: string;
  committeeColor: string;
  taskName?: string;
  inputManDays?: number;
  outputValue?: number;
}

const TYPE_CONFIG = {
  "提效": {
    label: "提效",
    color: "oklch(0.45 0.18 200)",
    bgColor: "oklch(0.95 0.04 200)",
    borderColor: "oklch(0.78 0.10 200)",
    unit: "小时/次",
    desc: "记录 AI 介入后每次操作节省的工时，年化计算基于月频次×12个月",
    beforeLabel: "AI前耗时",
    afterLabel: "AI后耗时",
    icon: "⚡",
    gradient: "from-blue-50 to-cyan-50",
  },
  "降本": {
    label: "降本",
    color: "oklch(0.42 0.16 145)",
    bgColor: "oklch(0.95 0.04 145)",
    borderColor: "oklch(0.72 0.12 145)",
    unit: "元/月",
    desc: "记录 AI 介入后每月节省的成本，年化计算基于月节省×12个月",
    beforeLabel: "AI前成本",
    afterLabel: "AI后成本",
    icon: "💰",
    gradient: "from-green-50 to-emerald-50",
  },
  "增收": {
    label: "增收",
    color: "oklch(0.42 0.18 22)",
    bgColor: "oklch(0.97 0.04 22)",
    borderColor: "oklch(0.78 0.12 22)",
    unit: "万元/年",
    desc: "记录 AI 介入带来的额外收入，直接填写年化增收金额",
    beforeLabel: "AI前收入",
    afterLabel: "AI后收入",
    icon: "📈",
    gradient: "from-orange-50 to-amber-50",
  },
};

const EMPTY_FORM = {
  scenario: "",
  beforeValue: "",
  afterValue: "",
  unit: "小时/次",
  frequency: "1",
  remark: "",
};

type OutcomeRecord = {
  id: number;
  taskId: string;
  committeeId: string;
  type: string;
  scenario: string;
  beforeValue: number;
  afterValue: number;
  unit: string;
  frequency: number | null;
  remark: string | null;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function calcAnnual(record: OutcomeRecord): number {
  const diff = record.beforeValue - record.afterValue;
  const freq = record.frequency ?? 1;
  if (record.type === "提效") return diff * freq * 12;
  if (record.type === "降本") return diff * freq * 12;
  return (record.afterValue - record.beforeValue) * freq;
}

function calcROI(record: OutcomeRecord): number {
  if (record.beforeValue <= 0) return 0;
  const diff = record.type === "增收"
    ? record.afterValue - record.beforeValue
    : record.beforeValue - record.afterValue;
  return (diff / record.beforeValue) * 100;
}

// ─── 效益等级评估 ─────────────────────────────────────────────
function getEfficiencyLevel(roiPct: number): { label: string; color: string; icon: React.ReactNode } {
  if (roiPct >= 80) return { label: "卓越", color: "oklch(0.42 0.18 22)", icon: <Award size={12} /> };
  if (roiPct >= 50) return { label: "优秀", color: "oklch(0.42 0.16 145)", icon: <CheckCircle size={12} /> };
  if (roiPct >= 20) return { label: "良好", color: "oklch(0.45 0.18 200)", icon: <Activity size={12} /> };
  if (roiPct >= 0) return { label: "一般", color: "oklch(0.55 0.08 60)", icon: <Clock size={12} /> };
  return { label: "待优化", color: "oklch(0.55 0.18 22)", icon: <AlertCircle size={12} /> };
}

// ─── 简单柱状图组件 ─────────────────────────────────────────────
function MiniBarChart({ data, color }: { data: { label: string; value: number; max: number }[]; color: string }) {
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="text-[10px] text-muted-foreground w-20 truncate shrink-0">{item.label}</div>
          <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: "oklch(0.92 0.008 75)" }}>
            <div
              className="h-full rounded-sm transition-all duration-500"
              style={{
                width: `${item.max > 0 ? Math.min(100, (item.value / item.max) * 100) : 0}%`,
                background: color,
                opacity: 0.85,
              }}
            />
          </div>
          <div className="text-[10px] font-mono w-16 text-right shrink-0" style={{ color }}>
            {item.value.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ROI仪表盘 ─────────────────────────────────────────────────
function ROIDashboard({ outcomes }: { outcomes: OutcomeRecord[] }) {
  const totalAnnual = outcomes.reduce((s, r) => {
    const v = calcAnnual(r);
    if (r.type === "提效") return s + v * 300 / 8 / 10000; // 按300元/小时换算万元
    if (r.type === "降本") return s + v / 10000;
    return s + v;
  }, 0);

  const avgROI = outcomes.length > 0
    ? outcomes.reduce((s, r) => s + calcROI(r), 0) / outcomes.length
    : 0;

  const level = getEfficiencyLevel(avgROI);

  const typeBreakdown = [
    { type: "提效", count: outcomes.filter(o => o.type === "提效").length, color: TYPE_CONFIG["提效"].color },
    { type: "降本", count: outcomes.filter(o => o.type === "降本").length, color: TYPE_CONFIG["降本"].color },
    { type: "增收", count: outcomes.filter(o => o.type === "增收").length, color: TYPE_CONFIG["增收"].color },
  ];

  return (
    <div
      className="rounded-sm p-4"
      style={{ background: "oklch(0.97 0.008 75)", border: "1px solid oklch(0.86 0.012 75)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} style={{ color: "oklch(0.42 0.18 22)" }} />
        <span className="text-xs font-semibold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          效益综合仪表盘
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{outcomes.length} 条记录</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* 综合年化价值 */}
        <div className="rounded-sm p-2.5 text-center" style={{ background: "white", border: "1px solid oklch(0.90 0.008 75)" }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign size={11} style={{ color: "oklch(0.42 0.18 22)" }} />
            <span className="text-[10px] text-muted-foreground">综合年化价值</span>
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: "oklch(0.42 0.18 22)" }}>
            ¥{totalAnnual.toFixed(1)}万
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">提效按300元/时折算</div>
        </div>

        {/* 平均ROI */}
        <div className="rounded-sm p-2.5 text-center" style={{ background: "white", border: "1px solid oklch(0.90 0.008 75)" }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target size={11} style={{ color: level.color }} />
            <span className="text-[10px] text-muted-foreground">平均改善率</span>
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: level.color }}>
            {avgROI.toFixed(0)}%
          </div>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span style={{ color: level.color }}>{level.icon}</span>
            <span className="text-[9px]" style={{ color: level.color }}>{level.label}</span>
          </div>
        </div>

        {/* 效益分布 */}
        <div className="rounded-sm p-2.5" style={{ background: "white", border: "1px solid oklch(0.90 0.008 75)" }}>
          <div className="text-[10px] text-muted-foreground mb-1.5 text-center">效益类型分布</div>
          <div className="space-y-1">
            {typeBreakdown.map(t => (
              <div key={t.type} className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: t.color }}>{t.type}</span>
                <div className="flex items-center gap-1">
                  <div
                    className="h-1.5 rounded-sm"
                    style={{
                      width: `${Math.max(4, t.count * 12)}px`,
                      background: t.color,
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-[10px] font-mono" style={{ color: t.color }}>{t.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 效益对比分析 ─────────────────────────────────────────────
function EfficiencyComparison({ outcomes }: { outcomes: OutcomeRecord[] }) {
  const tiXiaoData = outcomes
    .filter(o => o.type === "提效")
    .map(o => ({
      label: o.scenario,
      value: calcAnnual(o),
      max: Math.max(...outcomes.filter(x => x.type === "提效").map(x => calcAnnual(x)), 1),
    }));

  const jiangBenData = outcomes
    .filter(o => o.type === "降本")
    .map(o => ({
      label: o.scenario,
      value: calcAnnual(o) / 10000,
      max: Math.max(...outcomes.filter(x => x.type === "降本").map(x => calcAnnual(x) / 10000), 1),
    }));

  const zengShouData = outcomes
    .filter(o => o.type === "增收")
    .map(o => ({
      label: o.scenario,
      value: calcAnnual(o),
      max: Math.max(...outcomes.filter(x => x.type === "增收").map(x => calcAnnual(x)), 1),
    }));

  if (outcomes.length === 0) return null;

  return (
    <div
      className="rounded-sm p-4"
      style={{ background: "oklch(0.99 0.003 80)", border: "1px solid oklch(0.90 0.008 75)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} style={{ color: "oklch(0.45 0.18 200)" }} />
        <span className="text-xs font-semibold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          场景效益对比分析
        </span>
      </div>

      <div className="space-y-4">
        {tiXiaoData.length > 0 && (
          <div>
            <div className="text-[10px] font-medium mb-2 flex items-center gap-1" style={{ color: TYPE_CONFIG["提效"].color }}>
              <Zap size={10} /> 提效场景（年化节省工时 h）
            </div>
            <MiniBarChart data={tiXiaoData} color={TYPE_CONFIG["提效"].color} />
          </div>
        )}

        {jiangBenData.length > 0 && (
          <div>
            <div className="text-[10px] font-medium mb-2 flex items-center gap-1" style={{ color: TYPE_CONFIG["降本"].color }}>
              <TrendingDown size={10} /> 降本场景（年化降本 万元）
            </div>
            <MiniBarChart data={jiangBenData} color={TYPE_CONFIG["降本"].color} />
          </div>
        )}

        {zengShouData.length > 0 && (
          <div>
            <div className="text-[10px] font-medium mb-2 flex items-center gap-1" style={{ color: TYPE_CONFIG["增收"].color }}>
              <TrendingUp size={10} /> 增收场景（年化增收 万元）
            </div>
            <MiniBarChart data={zengShouData} color={TYPE_CONFIG["增收"].color} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 单条记录卡片 ─────────────────────────────────────────────
function RecordCard({
  record,
  onEdit,
  onDelete,
}: {
  record: OutcomeRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = TYPE_CONFIG[record.type as OutcomeType];
  const annual = calcAnnual(record);
  const roi = calcROI(record);
  const level = getEfficiencyLevel(roi);
  const isPositive = record.type === "增收"
    ? record.afterValue > record.beforeValue
    : record.beforeValue > record.afterValue;
  const diffPct = record.beforeValue > 0
    ? Math.abs((record.afterValue - record.beforeValue) / record.beforeValue * 100).toFixed(0)
    : "∞";

  return (
    <div
      className="rounded-sm p-3 group relative"
      style={{ background: "oklch(0.975 0.004 80)", border: "1px solid oklch(0.90 0.008 75)" }}
    >
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded-sm hover:bg-black/10 transition-colors">
          <Edit2 size={11} style={{ color: "oklch(0.45 0.015 60)" }} />
        </button>
        <button onClick={onDelete} className="p-1 rounded-sm hover:bg-red-50 transition-colors">
          <Trash2 size={11} style={{ color: "oklch(0.55 0.18 22)" }} />
        </button>
      </div>

      <div className="pr-14">
        {/* 标题行 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm font-medium text-foreground" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {record.scenario}
          </div>
          <div
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[9px] font-medium ml-auto shrink-0"
            style={{ background: cfg.bgColor, color: level.color, border: `1px solid ${cfg.borderColor}` }}
          >
            {level.icon}
            <span className="ml-0.5">{level.label}</span>
          </div>
        </div>

        {/* 前后对比 */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex-1 p-2 rounded-sm text-center"
            style={{ background: "oklch(0.94 0.02 22)", border: "1px solid oklch(0.85 0.06 22)" }}
          >
            <div className="text-[10px] text-muted-foreground mb-0.5">{cfg.beforeLabel}</div>
            <div className="text-sm font-bold font-mono" style={{ color: "oklch(0.45 0.15 22)" }}>
              {record.beforeValue} <span className="text-[10px] font-normal">{record.unit}</span>
            </div>
          </div>

          <div className="text-base" style={{ color: cfg.color }}>→</div>

          <div
            className="flex-1 p-2 rounded-sm text-center"
            style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}
          >
            <div className="text-[10px] text-muted-foreground mb-0.5">{cfg.afterLabel}</div>
            <div className="text-sm font-bold font-mono" style={{ color: cfg.color }}>
              {record.afterValue} <span className="text-[10px] font-normal">{record.unit}</span>
            </div>
          </div>

          <div
            className="px-2 py-1 rounded-sm text-center min-w-[56px]"
            style={{
              background: isPositive ? cfg.bgColor : "oklch(0.95 0.02 22)",
              border: `1px solid ${isPositive ? cfg.borderColor : "oklch(0.85 0.06 22)"}`
            }}
          >
            <div className="text-[10px] text-muted-foreground mb-0.5">改善率</div>
            <div className="text-xs font-bold font-mono" style={{ color: isPositive ? cfg.color : "oklch(0.45 0.15 22)" }}>
              {isPositive ? "-" : "+"}{diffPct}%
            </div>
          </div>
        </div>

        {/* 频次 + 年化 + ROI */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">频次：{record.frequency ?? 1}次/月</span>
          <div className="flex items-center gap-3">
            <span className="font-mono font-medium" style={{ color: cfg.color }}>
              年化：{record.type === "提效"
                ? `节省 ${annual.toFixed(0)}h`
                : record.type === "降本"
                ? `降本 ¥${(annual / 10000).toFixed(2)}万`
                : `增收 ¥${annual.toFixed(2)}万`
              }
            </span>
            <span
              className="px-1.5 py-0.5 rounded-sm font-mono"
              style={{ background: cfg.bgColor, color: level.color }}
            >
              ROI {roi.toFixed(0)}%
            </span>
          </div>
        </div>

        {record.remark && (
          <div className="mt-1.5 text-[10px] text-muted-foreground italic flex items-start gap-1">
            <Info size={9} className="mt-0.5 shrink-0" />
            {record.remark}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 录入表单 ─────────────────────────────────────────────────
function OutcomeForm({
  formType,
  form,
  setForm,
  onSubmit,
  onCancel,
  isLoading,
  isEditing,
}: {
  formType: OutcomeType;
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  isEditing: boolean;
}) {
  const cfg = TYPE_CONFIG[formType];

  // 实时预览计算
  const previewBefore = parseFloat(form.beforeValue) || 0;
  const previewAfter = parseFloat(form.afterValue) || 0;
  const previewFreq = parseFloat(form.frequency) || 1;
  const previewDiff = formType === "增收"
    ? (previewAfter - previewBefore) * previewFreq
    : (previewBefore - previewAfter) * previewFreq * 12;
  const previewROI = previewBefore > 0
    ? Math.abs((previewAfter - previewBefore) / previewBefore * 100)
    : 0;

  return (
    <div
      className="rounded-sm p-4 space-y-3"
      style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}
    >
      <div className="text-xs font-semibold mb-1" style={{ color: cfg.color, fontFamily: "'Noto Serif SC', serif" }}>
        {isEditing ? `编辑${formType}记录` : `新增${formType}记录`}
        <span className="ml-2 text-[10px] font-normal opacity-70">{cfg.desc}</span>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground mb-1 block">场景描述 *</label>
        <input
          className="w-full px-2.5 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none focus:ring-1"
          style={{ "--tw-ring-color": cfg.color } as any}
          placeholder={`例：合同审核、${formType === "提效" ? "报表生成" : formType === "降本" ? "人工替代" : "新客户获取"}`}
          value={form.scenario}
          onChange={e => setForm({ ...form, scenario: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">{cfg.beforeLabel} *</label>
          <input
            type="number"
            className="w-full px-2.5 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
            placeholder="0"
            value={form.beforeValue}
            onChange={e => setForm({ ...form, beforeValue: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">{cfg.afterLabel} *</label>
          <input
            type="number"
            className="w-full px-2.5 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
            placeholder="0"
            value={form.afterValue}
            onChange={e => setForm({ ...form, afterValue: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">单位 *</label>
          <input
            className="w-full px-2.5 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
            placeholder={cfg.unit}
            value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">
            {formType === "增收" ? "年化倍数" : "频次（次/月）"}
          </label>
          <input
            type="number"
            className="w-full px-2.5 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
            placeholder="1"
            value={form.frequency}
            onChange={e => setForm({ ...form, frequency: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">备注</label>
          <input
            className="w-full px-2.5 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
            placeholder="可选，如数据来源、计算依据"
            value={form.remark}
            onChange={e => setForm({ ...form, remark: e.target.value })}
          />
        </div>
      </div>

      {/* 实时预览 */}
      {(previewBefore > 0 || previewAfter > 0) && (
        <div
          className="rounded-sm p-2.5 flex items-center justify-between"
          style={{ background: "white", border: `1px solid ${cfg.borderColor}` }}
        >
          <span className="text-[10px] text-muted-foreground">预览：</span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono" style={{ color: cfg.color }}>
              年化{formType === "提效" ? `节省 ${previewDiff.toFixed(0)}h` : formType === "降本" ? `降本 ¥${(previewDiff / 10000).toFixed(2)}万` : `增收 ¥${previewDiff.toFixed(2)}万`}
            </span>
            <span className="text-[10px] font-mono" style={{ color: cfg.color }}>
              改善率 {previewROI.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm font-medium transition-all disabled:opacity-50"
          style={{ background: cfg.color, color: "white" }}
        >
          {isLoading ? <Loader2 size={11} className="animate-spin" /> : null}
          {isEditing ? "保存修改" : "添加记录"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────
export default function OutcomePanel({
  committeeId,
  taskId,
  committeeColor,
  taskName,
  inputManDays,
  outputValue,
}: OutcomePanelProps) {
  const [expandedType, setExpandedType] = useState<OutcomeType | null>("提效");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<OutcomeType>("提效");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"records" | "analysis">("records");
  const utils = trpc.useUtils();

  const { data: outcomes = [], isLoading } = trpc.outcomes.listByTask.useQuery({ taskId });

  const createMutation = trpc.outcomes.create.useMutation({
    onSuccess: () => {
      utils.outcomes.listByTask.invalidate({ taskId });
      toast.success("效益记录已添加");
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err) => toast.error(`添加失败：${err.message}`),
  });

  const updateMutation = trpc.outcomes.update.useMutation({
    onSuccess: () => {
      utils.outcomes.listByTask.invalidate({ taskId });
      toast.success("效益记录已更新");
      setEditingId(null);
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err) => toast.error(`更新失败：${err.message}`),
  });

  const deleteMutation = trpc.outcomes.delete.useMutation({
    onSuccess: () => {
      utils.outcomes.listByTask.invalidate({ taskId });
      toast.success("效益记录已删除");
    },
    onError: (err) => toast.error(`删除失败：${err.message}`),
  });

  const grouped = {
    "提效": outcomes.filter(o => o.type === "提效"),
    "降本": outcomes.filter(o => o.type === "降本"),
    "增收": outcomes.filter(o => o.type === "增收"),
  };

  const summary = useMemo(() => ({
    提效: grouped["提效"].reduce((s, r) => s + calcAnnual(r), 0),
    降本: grouped["降本"].reduce((s, r) => s + calcAnnual(r), 0),
    增收: grouped["增收"].reduce((s, r) => s + calcAnnual(r), 0),
  }), [outcomes]);

  // 综合年化价值（万元）
  const totalAnnualValue = useMemo(() => {
    const tiXiaoVal = summary.提效 * 300 / 8 / 10000; // 按300元/时折算
    const jiangBenVal = summary.降本 / 10000;
    const zengShouVal = summary.增收;
    return tiXiaoVal + jiangBenVal + zengShouVal;
  }, [summary]);

  const handleOpenForm = (type: OutcomeType, record?: OutcomeRecord) => {
    setFormType(type);
    if (record) {
      setEditingId(record.id);
      setForm({
        scenario: record.scenario,
        beforeValue: String(record.beforeValue),
        afterValue: String(record.afterValue),
        unit: record.unit,
        frequency: String(record.frequency ?? 1),
        remark: record.remark ?? "",
      });
    } else {
      setEditingId(null);
      setForm({ ...EMPTY_FORM, unit: TYPE_CONFIG[type].unit });
    }
    setShowForm(true);
    setExpandedType(type);
  };

  const handleSubmit = () => {
    if (!form.scenario.trim()) { toast.error("请填写场景描述"); return; }
    const before = parseFloat(form.beforeValue);
    const after = parseFloat(form.afterValue);
    if (isNaN(before) || isNaN(after)) { toast.error("请填写有效数值"); return; }
    if (!form.unit.trim()) { toast.error("请填写单位"); return; }
    const freq = parseFloat(form.frequency) || 1;
    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    if (isSubmitting) return;

    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId, type: formType, scenario: form.scenario.trim(),
        beforeValue: before, afterValue: after, unit: form.unit.trim(),
        frequency: freq, remark: form.remark.trim() || undefined
      });
    } else {
      createMutation.mutate({
        taskId, committeeId, type: formType,
        scenario: form.scenario.trim(), beforeValue: before, afterValue: after,
        unit: form.unit.trim(), frequency: freq, remark: form.remark.trim() || undefined
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-sm" style={{ color: "oklch(0.55 0.015 60)" }}>
        <Loader2 size={14} className="animate-spin" /> 加载效益数据中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部汇总卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {(["提效", "降本", "增收"] as OutcomeType[]).map((type) => {
          const cfg = TYPE_CONFIG[type];
          const val = summary[type];
          const count = grouped[type].length;
          return (
            <div
              key={type}
              className="p-3 rounded-sm text-center cursor-pointer transition-all hover:shadow-sm hover:scale-[1.02]"
              style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}
              onClick={() => {
                setActiveTab("records");
                setExpandedType(expandedType === type ? null : type);
              }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: cfg.color }}>
                {type === "提效" ? <Zap size={13} /> : type === "降本" ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                <span className="text-xs font-semibold">{type}</span>
              </div>
              <div className="text-xl font-bold font-mono" style={{ color: cfg.color }}>
                {type === "提效" ? `${val.toFixed(0)}h`
                  : type === "降本" ? `¥${(val / 10000).toFixed(1)}万`
                  : `¥${val.toFixed(1)}万`}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: cfg.color, opacity: 0.75 }}>
                年化 · {count}条记录
              </div>
            </div>
          );
        })}
      </div>

      {/* 综合年化价值汇总条 */}
      {outcomes.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-sm"
          style={{ background: "oklch(0.14 0.012 60)", border: "1px solid oklch(0.28 0.015 60)" }}
        >
          <div className="flex items-center gap-2">
            <Award size={13} style={{ color: "oklch(0.78 0.12 75)" }} />
            <span className="text-xs font-semibold" style={{ color: "oklch(0.88 0.008 75)", fontFamily: "'Noto Serif SC', serif" }}>
              综合年化价值
            </span>
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: "oklch(0.78 0.12 75)" }}>
            ¥{totalAnnualValue.toFixed(2)}万
          </div>
          <div className="text-[10px]" style={{ color: "oklch(0.55 0.02 60)" }}>
            提效折算+降本+增收
          </div>
        </div>
      )}

      {/* Tab切换：记录 / 分析 */}
      {outcomes.length > 0 && (
        <div className="flex gap-1 p-0.5 rounded-sm" style={{ background: "oklch(0.93 0.008 75)" }}>
          {[
            { key: "records" as const, label: "效益记录", icon: <CheckCircle size={11} /> },
            { key: "analysis" as const, label: "效益分析", icon: <BarChart2 size={11} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-sm transition-all"
              style={{
                background: activeTab === tab.key ? "white" : "transparent",
                color: activeTab === tab.key ? "oklch(0.25 0.015 60)" : "oklch(0.55 0.015 60)",
                fontWeight: activeTab === tab.key ? 600 : 400,
                boxShadow: activeTab === tab.key ? "0 1px 3px oklch(0 0 0 / 0.1)" : "none",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 分析视图 */}
      {activeTab === "analysis" && outcomes.length > 0 && (
        <div className="space-y-3">
          <ROIDashboard outcomes={outcomes} />
          <EfficiencyComparison outcomes={outcomes} />

          {/* 投入产出对比（如果有任务数据） */}
          {(inputManDays !== undefined || outputValue !== undefined) && (
            <div
              className="rounded-sm p-4"
              style={{ background: "oklch(0.99 0.003 80)", border: "1px solid oklch(0.90 0.008 75)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Target size={14} style={{ color: "oklch(0.42 0.16 145)" }} />
                <span className="text-xs font-semibold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  任务投入产出对比
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {inputManDays !== undefined && (
                  <div className="rounded-sm p-2.5 text-center" style={{ background: "oklch(0.95 0.04 22)", border: "1px solid oklch(0.85 0.06 22)" }}>
                    <div className="text-[10px] text-muted-foreground mb-1">投入人天</div>
                    <div className="text-xl font-bold font-mono" style={{ color: "oklch(0.45 0.15 22)" }}>{inputManDays}</div>
                    <div className="text-[9px] text-muted-foreground">人天</div>
                  </div>
                )}
                {outputValue !== undefined && (
                  <div className="rounded-sm p-2.5 text-center" style={{ background: "oklch(0.95 0.04 145)", border: "1px solid oklch(0.72 0.12 145)" }}>
                    <div className="text-[10px] text-muted-foreground mb-1">产出价值</div>
                    <div className="text-xl font-bold font-mono" style={{ color: "oklch(0.42 0.16 145)" }}>¥{(outputValue / 10000).toFixed(1)}万</div>
                    <div className="text-[9px] text-muted-foreground">元</div>
                  </div>
                )}
              </div>
              {inputManDays !== undefined && outputValue !== undefined && inputManDays > 0 && (
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">人天产出比</span>
                  <span className="font-mono font-medium" style={{ color: "oklch(0.42 0.16 145)" }}>
                    ¥{(outputValue / inputManDays).toFixed(0)}/人天
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 记录视图 */}
      {(activeTab === "records" || outcomes.length === 0) && (
        <>
          {/* 分类详情区块 */}
          {(["提效", "降本", "增收"] as OutcomeType[]).map((type) => {
            const cfg = TYPE_CONFIG[type];
            const records = grouped[type];
            const isExpanded = expandedType === type;
            const isThisForm = showForm && formType === type;

            return (
              <div key={type} className="rounded-sm overflow-hidden" style={{ border: `1px solid ${cfg.borderColor}` }}>
                {/* 区块标题栏 */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                  style={{ background: cfg.bgColor }}
                  onClick={() => setExpandedType(isExpanded ? null : type)}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: cfg.color }}>
                      {type === "提效" ? <Zap size={13} /> : type === "降本" ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: cfg.color, fontFamily: "'Noto Serif SC', serif" }}>
                      {type}核算
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-mono" style={{ background: cfg.borderColor, color: "white" }}>
                      {records.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono" style={{ color: cfg.color }}>
                      {type === "提效" ? `年化节省 ${summary[type].toFixed(0)}h`
                        : type === "降本" ? `年化降本 ¥${(summary[type] / 10000).toFixed(2)}万`
                        : `年化增收 ¥${summary[type].toFixed(2)}万`}
                    </span>
                    {isExpanded ? <ChevronDown size={13} style={{ color: cfg.color }} /> : <ChevronRight size={13} style={{ color: cfg.color }} />}
                  </div>
                </div>

                {/* 展开内容 */}
                {isExpanded && (
                  <div className="p-4 space-y-3" style={{ background: "oklch(0.99 0.003 80)" }}>
                    <p className="text-[11px] text-muted-foreground">{cfg.desc}</p>

                    {records.length === 0 && !isThisForm ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        <div className="text-2xl mb-2">{cfg.icon}</div>
                        <div>暂无{type}记录，点击下方按钮添加</div>
                        <div className="text-[10px] mt-1 opacity-60">{cfg.desc}</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {records.map((record) => (
                          <RecordCard
                            key={record.id}
                            record={record}
                            onEdit={() => handleOpenForm(type, record)}
                            onDelete={() => {
                              if (!confirm("确认删除该效益记录？")) return;
                              deleteMutation.mutate({ id: record.id });
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* 录入表单 */}
                    {isThisForm && (
                      <OutcomeForm
                        formType={formType}
                        form={form}
                        setForm={setForm}
                        onSubmit={handleSubmit}
                        onCancel={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
                        isLoading={createMutation.isPending || updateMutation.isPending}
                        isEditing={editingId !== null}
                      />
                    )}

                    {!isThisForm && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenForm(type); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border font-medium transition-all hover:opacity-80 w-full justify-center"
                        style={{ borderColor: cfg.borderColor, color: cfg.color, background: cfg.bgColor }}
                      >
                        <Plus size={11} /> 添加{type}记录
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 总效益摘要 */}
          {outcomes.length > 0 && (
            <div
              className="p-3 rounded-sm"
              style={{ background: "oklch(0.97 0.008 75)", border: "1px solid oklch(0.86 0.012 75)" }}
            >
              <div className="text-xs font-semibold text-foreground mb-2" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                综合效益摘要
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div>
                  <div className="text-[10px] text-muted-foreground">年化节省工时</div>
                  <div className="text-sm font-bold font-mono" style={{ color: "oklch(0.45 0.18 200)" }}>{summary.提效.toFixed(0)}h</div>
                  <div className="text-[9px] text-muted-foreground">≈¥{(summary.提效 * 300 / 8 / 10000).toFixed(2)}万</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">年化降本</div>
                  <div className="text-sm font-bold font-mono" style={{ color: "oklch(0.42 0.16 145)" }}>¥{(summary.降本 / 10000).toFixed(2)}万</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">年化增收</div>
                  <div className="text-sm font-bold font-mono" style={{ color: "oklch(0.42 0.18 22)" }}>¥{summary.增收.toFixed(2)}万</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground">综合年化价值（提效折算+降本+增收）</span>
                <span className="text-sm font-bold font-mono" style={{ color: "oklch(0.42 0.18 22)" }}>
                  ¥{totalAnnualValue.toFixed(2)}万
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
