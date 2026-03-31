/**
 * 快速新建任务弹窗
 * 支持：单个任务创建 + 批量导入（粘贴多行文本）
 */

import { useState } from "react";
import { X, Plus, Upload, Loader2, CheckCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import type { Committee } from "@/data/kanbanData";
import { committees as staticCommittees } from "@/data/kanbanData";

interface QuickCreateModalProps {
  committeeId: string;
  onClose: () => void;
  onSaved?: () => void;
}

type Mode = "single" | "batch";

export default function QuickCreateModal({ committeeId, onClose, onSaved }: QuickCreateModalProps) {
  const [mode, setMode] = useState<Mode>("single");
  const [singleName, setSingleName] = useState("");
  const [batchText, setBatchText] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const utils = trpc.useUtils();

  const committee = staticCommittees.find(c => c.id === committeeId);

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate();
      utils.tasks.list.invalidate({ committeeId });
      utils.tasks.weeklyStats.invalidate();
      setSuccess(true);
      setCreatedCount(1);
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 1200);
    },
  });

  const batchCreateMutation = trpc.tasks.batchCreate.useMutation({
    onSuccess: (data) => {
      utils.tasks.listAll.invalidate();
      utils.tasks.list.invalidate({ committeeId });
      utils.tasks.weeklyStats.invalidate();
      setSuccess(true);
      setCreatedCount(data.length);
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 1500);
    },
  });

  const isPending = createMutation.isPending || batchCreateMutation.isPending;

  // 解析批量文本：按换行分割，过滤空行和重复
  const parseBatchNames = (text: string): string[] => {
    return text
      .split("\n")
      .map(line => line.trim().replace(/^[-•·\d\.]+\s*/, "")) // 去掉前缀符号
      .filter(line => line.length > 0 && line.length <= 200)
      .filter((line, idx, arr) => arr.indexOf(line) === idx); // 去重
  };

  const batchNames = parseBatchNames(batchText);

  const handleSingleSubmit = () => {
    if (!singleName.trim()) return;
    createMutation.mutate({
      committeeId,
      name: singleName.trim(),
      goal: "",
      strategy: "",
      status: "待启动",
    });
  };

  const handleBatchSubmit = () => {
    if (batchNames.length === 0) return;
    batchCreateMutation.mutate({ committeeId, names: batchNames });
  };

  // 下载 Excel 模板
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["任务名称", "备注（可选）"],
      ["示例：推进客户A合同签约", "本月重点"],
      ["示例：完成市场调研报告", "需要协作"],
      ["示例：组织季度战略复盘会议", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "任务列表");
    XLSX.writeFile(wb, `${committee?.shortName || committeeId}_任务导入模板.xlsx`);
  };

  const committeeColor = committee?.color || "oklch(0.42 0.18 22)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0.08 0.01 60 / 0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="war-card rounded-sm w-full max-w-md mx-4 overflow-hidden"
        style={{ borderLeftColor: committeeColor, borderLeftWidth: 3 }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              {committee?.icon} 快速新建任务
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{committee?.shortName || committeeId}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 模式切换 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setMode("single")}
            className="flex-1 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: mode === "single" ? committeeColor : "oklch(0.55 0.02 60)",
              borderBottom: mode === "single" ? `2px solid ${committeeColor}` : "2px solid transparent",
              background: mode === "single" ? `${committeeColor}08` : "transparent",
            }}
          >
            <Plus size={12} className="inline mr-1" />
            单个新建
          </button>
          <button
            onClick={() => setMode("batch")}
            className="flex-1 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: mode === "batch" ? committeeColor : "oklch(0.55 0.02 60)",
              borderBottom: mode === "batch" ? `2px solid ${committeeColor}` : "2px solid transparent",
              background: mode === "batch" ? `${committeeColor}08` : "transparent",
            }}
          >
            <Upload size={12} className="inline mr-1" />
            批量导入
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-5 py-4">
          {success ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle size={32} style={{ color: committeeColor }} />
              <div className="text-sm font-medium text-foreground">
                成功创建 {createdCount} 个任务
              </div>
              <div className="text-xs text-muted-foreground">正在关闭...</div>
            </div>
          ) : mode === "single" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">任务名称</label>
                <input
                  type="text"
                  value={singleName}
                  onChange={e => setSingleName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSingleSubmit(); }}
                  placeholder="输入任务名称，按 Enter 快速创建"
                  autoFocus
                  className="w-full text-sm px-3 py-2 rounded-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all"
                  style={{ focusRingColor: committeeColor } as React.CSSProperties}
                  maxLength={200}
                />
                <div className="text-[10px] text-muted-foreground mt-1 text-right">{singleName.length}/200</div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                创建后状态默认为"待启动"，可在任务详情中进一步完善信息。
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted-foreground">
                    粘贴任务列表（每行一个任务名称）
                  </label>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm transition-colors hover:opacity-80"
                    style={{ color: committeeColor, background: `${committeeColor}12`, border: `1px solid ${committeeColor}30` }}
                    title="下载 Excel 模板"
                  >
                    <Download size={10} />
                    下载模板
                  </button>
                </div>
                <textarea
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  placeholder={"例如：\n推进客户A合同签约\n完成市场调研报告\n组织季度战略复盘会议"}
                  autoFocus
                  rows={7}
                  className="w-full text-sm px-3 py-2 rounded-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all resize-none font-mono"
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  支持直接粘贴文本，或下载 Excel 模板填写后复制粘贴第一列内容
                </div>
              </div>
              {batchNames.length > 0 && (
                <div
                  className="rounded-sm p-3 space-y-1"
                  style={{ background: `${committeeColor}08`, border: `1px solid ${committeeColor}30` }}
                >
                  <div className="text-[10px] font-medium mb-2" style={{ color: committeeColor }}>
                    解析到 {batchNames.length} 个任务：
                  </div>
                  {batchNames.slice(0, 8).map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                      <span className="text-[9px] font-mono text-muted-foreground w-4 text-right">{i + 1}</span>
                      <span className="truncate">{name}</span>
                    </div>
                  ))}
                  {batchNames.length > 8 && (
                    <div className="text-[10px] text-muted-foreground">...还有 {batchNames.length - 8} 个</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {!success && (
          <div className="flex gap-2 px-5 pb-4">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-xs rounded-sm border border-border text-muted-foreground hover:bg-accent/30 transition-colors"
            >
              取消
            </button>
            <button
              onClick={mode === "single" ? handleSingleSubmit : handleBatchSubmit}
              disabled={isPending || (mode === "single" ? !singleName.trim() : batchNames.length === 0)}
              className="flex-1 py-2 text-xs rounded-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: committeeColor }}
            >
              {isPending ? (
                <><Loader2 size={12} className="animate-spin" />创建中...</>
              ) : mode === "single" ? (
                <><Plus size={12} />创建任务</>
              ) : (
                <><Upload size={12} />批量创建 {batchNames.length} 个</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
