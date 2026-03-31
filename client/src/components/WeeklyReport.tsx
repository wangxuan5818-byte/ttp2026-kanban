/*
 * 周报一键导出 PDF 组件
 * 汇总委员会本周任务状态、里程碑进度、积分奖金
 * 使用浏览器 print API 生成 PDF（无需后端）
 */

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { X, Download, Loader2, FileText, CheckCircle, AlertCircle, Clock, Play } from "lucide-react";
import { committees } from "@/data/kanbanData";
import { toast } from "sonner";

interface WeeklyReportProps {
  committeeId: string;
  onClose: () => void;
}

const statusConfig = {
  "进行中": { label: "进行中", color: "#1a6b3c", bg: "#e6f7ef", icon: Play },
  "已完成": { label: "已结束", color: "#0d5c8f", bg: "#e6f0fa", icon: CheckCircle },
  "已结束": { label: "已结束", color: "#0d5c8f", bg: "#e6f0fa", icon: CheckCircle },
  "有卡点": { label: "有卡点", color: "#b02a37", bg: "#fde8ea", icon: AlertCircle },
  "待启动": { label: "待启动", color: "#7a5c1e", bg: "#fef9e7", icon: Clock },
};

export default function WeeklyReport({ committeeId, onClose }: WeeklyReportProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const committee = committees.find(c => c.id === committeeId);

  const { data, isLoading, error } = trpc.report.weeklyData.useQuery({ committeeId });

  const handleExportPDF = () => {
    if (!printRef.current) return;
    setIsPrinting(true);

    // 创建打印窗口
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("请允许弹出窗口以导出 PDF");
      setIsPrinting(false);
      return;
    }

    const styles = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;600&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Noto Sans SC', sans-serif; font-size: 11px; color: #1a1a1a; background: white; }
      .page { padding: 20mm 18mm; max-width: 210mm; margin: 0 auto; }
      h1 { font-family: 'Noto Serif SC', serif; font-size: 20px; font-weight: 700; color: #1a1a1a; }
      h2 { font-family: 'Noto Serif SC', serif; font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; }
      h3 { font-family: 'Noto Serif SC', serif; font-size: 12px; font-weight: 600; color: #333; margin-bottom: 6px; }
      .header { border-bottom: 2px solid #8b1a1a; padding-bottom: 12px; margin-bottom: 16px; }
      .header-meta { display: flex; justify-content: space-between; align-items: flex-end; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 2px; font-size: 10px; font-weight: 600; }
      .section { margin-bottom: 16px; }
      .section-title { display: flex; align-items: center; gap: 6px; font-family: 'Noto Serif SC', serif; font-size: 13px; font-weight: 700; color: #8b1a1a; border-bottom: 1px solid #e8d5b0; padding-bottom: 4px; margin-bottom: 10px; }
      .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
      .stat-card { background: #faf7f2; border: 1px solid #e8d5b0; border-radius: 3px; padding: 8px; text-align: center; }
      .stat-num { font-size: 22px; font-weight: 700; font-family: 'Noto Serif SC', serif; color: #8b1a1a; }
      .stat-label { font-size: 9px; color: #666; margin-top: 2px; }
      .task-item { border: 1px solid #e8d5b0; border-radius: 3px; padding: 8px 10px; margin-bottom: 6px; border-left: 3px solid #8b1a1a; }
      .task-name { font-weight: 600; font-size: 11px; margin-bottom: 3px; }
      .task-meta { display: flex; gap: 12px; font-size: 9px; color: #666; }
      .task-goal { font-size: 10px; color: #444; margin-top: 3px; line-height: 1.4; }
      .progress-bar { height: 4px; background: #e8d5b0; border-radius: 2px; margin-top: 4px; }
      .progress-fill { height: 100%; background: #8b1a1a; border-radius: 2px; }
      .score-table { width: 100%; border-collapse: collapse; font-size: 10px; }
      .score-table th { background: #8b1a1a; color: white; padding: 5px 8px; text-align: left; font-weight: 600; }
      .score-table td { padding: 5px 8px; border-bottom: 1px solid #e8d5b0; }
      .score-table tr:nth-child(even) td { background: #faf7f2; }
      .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e8d5b0; font-size: 9px; color: #999; display: flex; justify-content: space-between; }
      .status-badge { display: inline-block; padding: 1px 6px; border-radius: 2px; font-size: 9px; font-weight: 600; }
      .blocked-section { background: #fde8ea; border: 1px solid #f5c6cb; border-radius: 3px; padding: 8px 10px; margin-bottom: 6px; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none; }
      }
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>${committee?.shortName || committeeId} 周报 - ${data?.weekStr}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="page">
          <!-- 页眉 -->
          <div class="header">
            <div class="header-meta">
              <div>
                <div style="font-size:10px;color:#8b1a1a;font-weight:600;margin-bottom:4px">TTP2026 · AI战略指挥中心</div>
                <h1>${committee?.icon || ""} ${committee?.fullName || committeeId}</h1>
                <div style="font-size:11px;color:#555;margin-top:4px">本周工作进展报告 · ${data?.weekStr || ""}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:10px;color:#999">报告日期：${data?.reportDate || ""}</div>
                <div style="font-size:10px;color:#999;margin-top:2px">负责人：${committee?.chairman || committee?.director || "—"}</div>
              </div>
            </div>
          </div>

          <!-- 概览数据 -->
          <div class="section">
            <div class="section-title">📊 本周概览</div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-num">${data?.summary.total || 0}</div>
                <div class="stat-label">总任务数</div>
              </div>
              <div class="stat-card" style="border-color:#a3d9b8">
                <div class="stat-num" style="color:#1a6b3c">${data?.summary.inProgress || 0}</div>
                <div class="stat-label">进行中</div>
              </div>
              <div class="stat-card" style="border-color:#a3c8e8">
                <div class="stat-num" style="color:#0d5c8f">${data?.summary.completed || 0}</div>
                <div class="stat-label">已结束</div>
              </div>
              <div class="stat-card" style="border-color:#f5c6cb">
                <div class="stat-num" style="color:#b02a37">${data?.summary.blocked || 0}</div>
                <div class="stat-label">有卡点</div>
              </div>
              <div class="stat-card">
                <div class="stat-num" style="color:#8b1a1a">${data?.summary.avgCompletion || 0}%</div>
                <div class="stat-label">平均完成度</div>
              </div>
            </div>
          </div>

          <!-- 有卡点任务（重点关注） -->
          ${(data?.byStatus["有卡点"] || []).length > 0 ? `
          <div class="section">
            <div class="section-title">⚠️ 卡点任务（需重点关注）</div>
            ${(data?.byStatus["有卡点"] || []).map((task: any) => `
              <div class="blocked-section">
                <div class="task-name">⚠️ ${task.name}</div>
                <div class="task-goal">${task.goal || ""}</div>
                <div class="task-meta" style="margin-top:4px">
                  <span>负责人：${task.manager || "未指定"}</span>
                  <span>完成度：${task.completionRate || 0}%</span>
                  <span>截止：${task.deadline || "未设置"}</span>
                </div>
                ${task.breakthrough ? `<div style="font-size:10px;color:#b02a37;margin-top:3px">突破点：${task.breakthrough}</div>` : ""}
              </div>
            `).join("")}
          </div>
          ` : ""}

          <!-- 进行中任务 -->
          ${(data?.byStatus["进行中"] || []).length > 0 ? `
          <div class="section">
            <div class="section-title">▶ 进行中任务</div>
            ${(data?.byStatus["进行中"] || []).map((task: any) => `
              <div class="task-item" style="border-left-color:#1a6b3c">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div class="task-name">${task.name}</div>
                  <span class="status-badge" style="background:#e6f7ef;color:#1a6b3c">进行中</span>
                </div>
                <div class="task-goal">${task.goal || ""}</div>
                <div class="task-meta">
                  <span>负责人：${task.manager || "未指定"}</span>
                  <span>完成度：${task.completionRate || 0}%</span>
                  <span>截止：${task.deadline || "未设置"}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${task.completionRate || 0}%;background:#1a6b3c"></div></div>
              </div>
            `).join("")}
          </div>
          ` : ""}

          <!-- 已结束任务 -->
          ${([...(data?.byStatus["已结束"] || []), ...(data?.byStatus["已完成"] || [])]).length > 0 ? `
          <div class="section">
            <div class="section-title">✅ 本周已结束任务</div>
            ${([...(data?.byStatus["已结束"] || []), ...(data?.byStatus["已完成"] || [])]).map((task: any) => `
              <div class="task-item" style="border-left-color:#0d5c8f">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div class="task-name">✓ ${task.name}</div>
                  <span class="status-badge" style="background:#e6f0fa;color:#0d5c8f">已结束</span>
                </div>
                ${task.result ? `<div class="task-goal">成果：${task.result}</div>` : ""}
                <div class="task-meta">
                  <span>负责人：${task.manager || "未指定"}</span>
                  ${task.score ? `<span>积分：${Math.round(task.score)}分</span>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
          ` : ""}

          <!-- 积分核算 -->
          ${(data?.scores || []).length > 0 ? `
          <div class="section">
            <div class="section-title">🏆 积分核算汇总</div>
            <table class="score-table">
              <thead>
                <tr>
                  <th>任务名称</th>
                  <th>完成度积分</th>
                  <th>质量积分</th>
                  <th>综合积分</th>
                  <th>奖金系数</th>
                  <th>预估奖金</th>
                </tr>
              </thead>
              <tbody>
                ${(data?.scores || []).map((s: any) => `
                  <tr>
                    <td>${s.taskId}</td>
                    <td>${Math.round(s.completionScore || 0)}</td>
                    <td>${Math.round(s.qualityScore || 0)}</td>
                    <td style="font-weight:600;color:#8b1a1a">${Math.round(s.totalScore || 0)}</td>
                    <td>${(s.bonusCoeff || 0).toFixed(1)}x</td>
                    <td style="font-weight:600">¥${Math.round(s.estimatedBonus || 0).toLocaleString()}</td>
                  </tr>
                `).join("")}
                <tr style="background:#faf7f2;font-weight:600">
                  <td>合计</td>
                  <td colspan="2">—</td>
                  <td style="color:#8b1a1a">${data?.summary.totalScore || 0}</td>
                  <td>—</td>
                  <td>¥${(data?.summary.totalBonus || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ""}

          <!-- 页脚 -->
          <div class="footer">
            <span>TTP2026 AI战略看板系统 · 自动生成</span>
            <span>本报告仅供内部使用，请勿外传</span>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      setIsPrinting(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-sm shadow-2xl"
        style={{ background: 'oklch(0.975 0.008 80)', border: '1px solid oklch(0.86 0.012 75)' }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'oklch(0.18 0.02 22)', borderBottom: '1px solid oklch(0.86 0.012 75)' }}
        >
          <div className="flex items-center gap-3">
            <FileText size={18} style={{ color: 'oklch(0.78 0.10 75)' }} />
            <h2 className="text-base font-bold" style={{ color: 'oklch(0.975 0.008 80)', fontFamily: "'Noto Serif SC', serif" }}>
              周报导出
            </h2>
            {committee && (
              <span className="text-xs" style={{ color: 'oklch(0.78 0.10 75)' }}>
                {committee.icon} {committee.shortName}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'oklch(0.78 0.10 75)' }} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> 加载周报数据...
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm" style={{ color: 'oklch(0.55 0.18 22)' }}>
              加载失败，请重试
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* 周报预览 */}
              <div
                className="p-4 rounded-sm"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                    {committee?.icon} {committee?.fullName} · 周报预览
                  </h3>
                  <span className="text-xs text-muted-foreground">{data.weekStr}</span>
                </div>

                {/* 数据概览 */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { label: "总任务", value: data.summary.total, color: 'oklch(0.42 0.18 22)' },
                    { label: "进行中", value: data.summary.inProgress, color: 'oklch(0.35 0.15 145)' },
                    { label: "已结束", value: data.summary.completed, color: 'oklch(0.35 0.12 200)' },
                    { label: "有卡点", value: data.summary.blocked, color: 'oklch(0.55 0.18 22)' },
                    { label: "平均完成", value: `${data.summary.avgCompletion}%`, color: 'oklch(0.42 0.15 60)' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="text-center p-2 rounded-sm"
                      style={{ background: 'white', border: '1px solid oklch(0.88 0.012 75)' }}
                    >
                      <div className="text-lg font-bold" style={{ color: item.color, fontFamily: "'Noto Serif SC', serif" }}>
                        {item.value}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* 卡点任务预警 */}
                {data.byStatus["有卡点"].length > 0 && (
                  <div
                    className="p-3 rounded-sm mb-3"
                    style={{ background: 'oklch(0.97 0.02 22)', border: '1px solid oklch(0.85 0.08 22)' }}
                  >
                    <div className="text-xs font-medium mb-2" style={{ color: 'oklch(0.42 0.18 22)' }}>
                      ⚠️ {data.byStatus["有卡点"].length} 项卡点任务需关注
                    </div>
                    {data.byStatus["有卡点"].map((t: any) => (
                      <div key={t.id} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'oklch(0.55 0.18 22)' }} />
                        {t.name}（{t.manager || "未指定"}）
                      </div>
                    ))}
                  </div>
                )}

                {/* 积分汇总 */}
                {data.summary.totalScore > 0 && (
                  <div
                    className="p-3 rounded-sm"
                    style={{ background: 'oklch(0.96 0.04 75)', border: '1px solid oklch(0.82 0.08 75)' }}
                  >
                    <div className="text-xs font-medium mb-1" style={{ color: 'oklch(0.45 0.12 75)' }}>
                      🏆 积分核算
                    </div>
                    <div className="flex gap-4 text-xs" style={{ color: 'oklch(0.45 0.12 75)' }}>
                      <span>综合积分：<strong>{data.summary.totalScore}</strong></span>
                      <span>平均积分：<strong>{data.summary.avgScore}</strong></span>
                      <span>预估奖金：<strong>¥{data.summary.totalBonus.toLocaleString()}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* 导出说明 */}
              <div
                className="p-3 rounded-sm text-xs"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px dashed oklch(0.86 0.012 75)' }}
              >
                <div className="font-medium mb-1" style={{ color: 'oklch(0.45 0.015 60)' }}>导出说明</div>
                <div className="text-muted-foreground space-y-0.5">
                  <div>点击「导出 PDF」后将在新窗口打开打印预览，选择「另存为 PDF」即可保存。</div>
                  <div>报告包含：本周概览、卡点任务、进行中任务、已结束任务、积分核算汇总。</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 底部操作 */}
        <div
          className="px-6 py-4 flex justify-end gap-3 shrink-0"
          style={{ borderTop: '1px solid oklch(0.86 0.012 75)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-sm border border-border hover:bg-muted transition-colors"
          >
            关闭
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isLoading || isPrinting || !data}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-sm font-medium disabled:opacity-50 transition-all"
            style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
          >
            {isPrinting ? (
              <><Loader2 size={14} className="animate-spin" /> 生成中...</>
            ) : (
              <><Download size={14} /> 导出 PDF</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
