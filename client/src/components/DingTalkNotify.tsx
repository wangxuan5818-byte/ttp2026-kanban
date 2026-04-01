/*
 * 钉钉通知配置组件（升级版）
 * 支持：
 * 1. 管理员保存钉钉配置（Webhook URL / AgentId 等）到数据库
 * 2. 测试写入：管理员验证通过即保存成功
 * 3. 配置群机器人 Webhook URL 并测试发送
 * 4. 任务状态变更通知发送
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  X, Bell, BellOff, Send, CheckCircle, AlertTriangle,
  ExternalLink, Info, Wifi, WifiOff, Loader2, Users, Save, Database
} from "lucide-react";

interface DingTalkNotifyProps {
  onClose: () => void;
  taskId?: string;
  taskName?: string;
  oldStatus?: string;
  newStatus?: string;
}

export default function DingTalkNotify({
  onClose,
  taskId,
  taskName,
  oldStatus,
  newStatus,
}: DingTalkNotifyProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [clientId, setClientId] = useState("dingeprmdsq7qp3arjxz");
  const [clientSecret, setClientSecret] = useState("mWXfTZ1XBFOPTDM1VXCgNPM9cj1Z48ItNdv1t7f4p-tJ53Vj17B-5L_dsZRrlUkC");
  const [agentId, setAgentId] = useState("4390267189");
  const [appId, setAppId] = useState("f481bf6d-1248-4f20-b7cd-f4bc4f05f83a");
  const [userIds, setUserIds] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: boolean; message?: string; reason?: string } | null>(null);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean; message?: string; error?: string;
    tokenPreview?: string; agentId?: string; clientId?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"connection" | "webhook" | "guide">("connection");

  // 加载已保存的配置
  const configQuery = trpc.notify.getWebhookConfig.useQuery(undefined, {
    onSuccess: (data: any) => {
      if (data?.webhookUrl) setWebhookUrl(data.webhookUrl);
      if (data?.clientId) setClientId(data.clientId);
      if ((data as any)?.clientSecret) setClientSecret((data as any).clientSecret);
      if (data?.agentId) setAgentId(data.agentId);
      if (data?.appId) setAppId(data.appId);
    },
    onError: () => {}, // 非管理员忽略错误
  });

  const notifyMutation = trpc.notify.taskStatusChange.useMutation({
    onSuccess: (result) => {
      setLastResult({ sent: result.sent, message: result.message, reason: result.reason });
      if (result.sent) {
        toast.success("钉钉通知发送成功！");
      } else {
        toast.warning(result.reason || "通知未发送");
      }
      setIsSending(false);
    },
    onError: (err) => {
      toast.error(`发送失败：${err.message}`);
      setIsSending(false);
    },
  });

  const testConnectionMutation = trpc.notify.testConnection.useMutation({
    onSuccess: (result) => {
      setConnectionResult(result as any);
      if ((result as any).success) {
        toast.success("✅ 钉钉配置验证通过，已保存！");
      } else {
        toast.error(`验证失败：${(result as any).error}`);
      }
      setIsTesting(false);
    },
    onError: (err) => {
      setConnectionResult({ success: false, error: err.message });
      toast.error(`测试失败：${err.message}`);
      setIsTesting(false);
    },
  });

  const saveConfigMutation = trpc.notify.setWebhookConfig.useMutation({
    onSuccess: () => {
      toast.success("✅ 钉钉配置已保存到数据库！");
      setIsSavingConfig(false);
    },
    onError: (err) => {
      toast.error(`保存失败：${err.message}`);
      setIsSavingConfig(false);
    },
  });

  const handleTestConnection = () => {
    setIsTesting(true);
    setConnectionResult(null);
    // 先保存配置，再测试
    saveConfigMutation.mutate({ webhookUrl, clientId, clientSecret, agentId, appId } as any);
    testConnectionMutation.mutate();
  };

  const handleSaveConfig = () => {
    setIsSavingConfig(true);
    saveConfigMutation.mutate({ webhookUrl, clientId, clientSecret, agentId, appId } as any);
  };

  const handleSendNotify = () => {
    if (!taskId) {
      toast.error("未指定任务");
      return;
    }
    if (!webhookUrl && !userIds.trim()) {
      toast.error("请填写 Webhook URL 或钉钉用户 ID");
      return;
    }
    setIsSending(true);
    setLastResult(null);
    const parsedUserIds = userIds.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
    notifyMutation.mutate({
      taskId,
      oldStatus: oldStatus || "进行中",
      newStatus: newStatus || "已结束",
      webhookUrl: webhookUrl || undefined,
      dingUserIds: parsedUserIds.length > 0 ? parsedUserIds : undefined,
    });
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error("请先填写 Webhook URL");
      return;
    }
    setIsSending(true);
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "text",
          text: { content: "✅ TTP2026 AI战略看板 Webhook 连接测试成功！" },
        }),
      });
      const data = await resp.json() as any;
      if (data.errcode === 0) {
        toast.success("Webhook 连接测试成功！");
      } else {
        toast.error(`测试失败：${data.errmsg || "未知错误"}`);
      }
    } catch {
      toast.error("连接失败，请检查 URL 是否正确");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col rounded-sm shadow-2xl"
        style={{ background: 'oklch(0.975 0.008 80)', border: '1px solid oklch(0.86 0.012 75)' }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'oklch(0.18 0.02 22)', borderBottom: '1px solid oklch(0.86 0.012 75)' }}
        >
          <div className="flex items-center gap-3">
            <Bell size={18} style={{ color: 'oklch(0.78 0.10 75)' }} />
            <div>
              <h2 className="text-base font-bold" style={{ color: 'oklch(0.975 0.008 80)', fontFamily: "'Noto Serif SC', serif" }}>
                钉钉通知配置
              </h2>
              <p className="text-[10px]" style={{ color: 'oklch(0.65 0.015 60)' }}>
                App ID: f481bf6d · AgentId: 4390267189
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'oklch(0.78 0.10 75)' }} />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b shrink-0" style={{ borderColor: 'oklch(0.86 0.012 75)' }}>
          {[
            { key: "connection", label: "应用连接" },
            { key: "webhook", label: "群通知配置" },
            { key: "guide", label: "使用说明" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="px-4 py-2.5 text-xs font-medium transition-colors"
              style={{
                color: activeTab === tab.key ? 'oklch(0.42 0.18 22)' : 'oklch(0.52 0.015 60)',
                borderBottom: activeTab === tab.key ? '2px solid oklch(0.42 0.18 22)' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* 应用连接测试 */}
          {activeTab === "connection" && (
            <div className="space-y-4">
              {/* 可编辑的凭证配置 */}
              <div
                className="p-4 rounded-sm space-y-3"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
              >
                <div className="text-xs font-semibold mb-2" style={{ color: 'oklch(0.35 0.015 60)', fontFamily: "'Noto Serif SC', serif" }}>
                  钉钉应用凭证配置
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-muted-foreground block mb-1">App ID</label>
                    <input
                      type="text"
                      value={appId}
                      onChange={e => setAppId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-sm border border-border bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Client ID（AppKey）</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-sm border border-border bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Client Secret（AppSecret）</label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-sm border border-border bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                      placeholder="已预填写，如需修改请直接输入"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">AgentId</label>
                    <input
                      type="text"
                      value={agentId}
                      onChange={e => setAgentId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-sm border border-border bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                    />
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                {/* 保存配置 */}
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-sm font-medium flex-1 justify-center transition-all disabled:opacity-50"
                  style={{ background: 'oklch(0.35 0.15 145)', color: 'white' }}
                >
                  {isSavingConfig ? (
                    <><Loader2 size={14} className="animate-spin" /> 保存中…</>
                  ) : (
                    <><Save size={14} /> 保存配置</>
                  )}
                </button>

                {/* 测试写入（管理员验证） */}
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-sm font-medium flex-1 justify-center transition-all disabled:opacity-50"
                  style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
                >
                  {isTesting ? (
                    <><Loader2 size={14} className="animate-spin" /> 验证中…</>
                  ) : (
                    <><Database size={14} /> 测试写入</>
                  )}
                </button>
              </div>

              {/* 连接结果 */}
              {connectionResult && (
                <div
                  className="p-4 rounded-sm"
                  style={{
                    background: connectionResult.success ? 'oklch(0.96 0.04 145)' : 'oklch(0.97 0.02 22)',
                    border: `1px solid ${connectionResult.success ? 'oklch(0.82 0.08 145)' : 'oklch(0.85 0.08 22)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {connectionResult.success ? (
                      <CheckCircle size={14} style={{ color: 'oklch(0.35 0.15 145)' }} />
                    ) : (
                      <WifiOff size={14} style={{ color: 'oklch(0.42 0.18 22)' }} />
                    )}
                    <span className="text-sm font-medium" style={{ color: connectionResult.success ? 'oklch(0.35 0.15 145)' : 'oklch(0.42 0.18 22)' }}>
                      {connectionResult.success ? "验证通过，配置已写入数据库" : "验证失败"}
                    </span>
                  </div>
                  {connectionResult.success ? (
                    <div className="text-xs space-y-1" style={{ color: 'oklch(0.35 0.15 145)' }}>
                      <div>✅ 管理员身份验证通过（{connectionResult.tokenPreview}）</div>
                      <div>✅ AgentId: {connectionResult.agentId}</div>
                      <div>✅ Client ID: {connectionResult.clientId}</div>
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: 'oklch(0.42 0.18 22)' }}>
                      ❌ {connectionResult.error}
                    </div>
                  )}
                </div>
              )}

              {/* 说明 */}
              <div
                className="p-3 rounded-sm text-xs space-y-2"
                style={{ background: 'oklch(0.96 0.04 200)', border: '1px solid oklch(0.82 0.08 200)' }}
              >
                <div className="flex items-start gap-2" style={{ color: 'oklch(0.35 0.12 200)' }}>
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">配置说明</div>
                    <div className="text-muted-foreground">
                      管理员可直接保存钉钉应用凭证。点击「测试写入」将同时保存配置并验证管理员身份。
                      Webhook URL 请在「群通知配置」标签页中填写。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 群通知配置 */}
          {activeTab === "webhook" && (
            <div className="space-y-4">
              {/* 任务信息（如果是针对特定任务） */}
              {taskId && (
                <div
                  className="p-3 rounded-sm"
                  style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
                >
                  <div className="text-xs font-medium mb-1" style={{ color: 'oklch(0.42 0.18 22)' }}>
                    当前通知任务
                  </div>
                  <div className="text-sm font-medium">{taskName}</div>
                  {oldStatus && newStatus && (
                    <div className="text-xs text-muted-foreground mt-1">
                      状态变更：{oldStatus} → <strong>{newStatus}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Webhook URL */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'oklch(0.35 0.015 60)' }}>
                  群机器人 Webhook URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                  className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  在钉钉群「智能群助手」→「添加机器人」→「自定义」中获取
                </div>
              </div>

              {/* 工作通知用户 ID */}
              <div>
                <label className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'oklch(0.35 0.015 60)' }}>
                  <Users size={11} /> 工作通知用户 ID（可选，多个用逗号分隔）
                </label>
                <textarea
                  value={userIds}
                  onChange={e => setUserIds(e.target.value)}
                  placeholder="输入钉钉 userId，多个用逗号分隔&#10;例如：user001,user002"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)] resize-none"
                />
              </div>

              {/* 通知触发规则 */}
              <div
                className="p-3 rounded-sm text-xs space-y-2"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px dashed oklch(0.86 0.012 75)' }}
              >
                <div className="font-medium" style={{ color: 'oklch(0.45 0.015 60)' }}>通知触发规则</div>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={12} style={{ color: 'oklch(0.55 0.18 22)', marginTop: 1 }} />
                  <span className="text-muted-foreground">任务状态变更为「有卡点」时，自动通知责任人和委员会主席</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle size={12} style={{ color: 'oklch(0.35 0.15 145)', marginTop: 1 }} />
                  <span className="text-muted-foreground">任务状态变更为「已结束」时，发送完成通知并提醒进行积分核算</span>
                </div>
                <div className="flex items-start gap-2">
                  <BellOff size={12} style={{ color: 'oklch(0.52 0.015 60)', marginTop: 1 }} />
                  <span className="text-muted-foreground">其他状态变更不触发通知</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {isSavingConfig ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  保存 Webhook
                </button>
                <button
                  onClick={handleTestWebhook}
                  disabled={isSending || !webhookUrl}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-sm border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Send size={12} /> 测试发送
                </button>
                {taskId && (
                  <button
                    onClick={handleSendNotify}
                    disabled={isSending || (!webhookUrl && !userIds.trim())}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-sm font-medium disabled:opacity-50"
                    style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
                  >
                    {isSending ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                    {isSending ? "发送中..." : "立即发送通知"}
                  </button>
                )}
              </div>

              {/* 发送结果 */}
              {lastResult && (
                <div
                  className="p-3 rounded-sm text-xs"
                  style={{
                    background: lastResult.sent ? 'oklch(0.96 0.04 145)' : 'oklch(0.97 0.02 22)',
                    border: `1px solid ${lastResult.sent ? 'oklch(0.82 0.08 145)' : 'oklch(0.85 0.08 22)'}`,
                    color: lastResult.sent ? 'oklch(0.35 0.15 145)' : 'oklch(0.42 0.18 22)',
                  }}
                >
                  {lastResult.sent ? `✅ ${lastResult.message}` : `⚠️ ${lastResult.reason}`}
                </div>
              )}
            </div>
          )}

          {/* 使用说明 */}
          {activeTab === "guide" && (
            <div className="space-y-4 text-xs">
              <div
                className="p-4 rounded-sm"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
              >
                <h3 className="font-semibold mb-3 text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  通知方式说明
                </h3>
                <div className="space-y-3 text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground mb-1">方式一：群机器人 Webhook（推荐）</div>
                    <p>在钉钉群中添加「自定义」机器人，获取 Webhook URL 后填入配置框。适合向整个委员会群发送通知。</p>
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">方式二：工作通知（精准推送）</div>
                    <p>通过企业内部应用 AgentId 向指定钉钉用户发送工作通知。需要知道用户的钉钉 userId，适合向特定责任人推送。</p>
                  </div>
                </div>
              </div>

              <div
                className="p-4 rounded-sm"
                style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}
              >
                <h3 className="font-semibold mb-3 text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  群机器人配置步骤
                </h3>
                <ol className="space-y-2 text-muted-foreground">
                  {[
                    "打开钉钉，进入需要接收通知的群聊",
                    "点击右上角「...」→「智能群助手」",
                    "选择「自定义」机器人，填写机器人名称（如：TTP2026战略看板）",
                    "安全设置选择「自定义关键词」，填入「TTP2026」",
                    "复制生成的 Webhook URL，粘贴到群通知配置框中",
                    "点击「保存 Webhook」保存配置，再点击「测试发送」验证",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}>
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <a
                href="https://open.dingtalk.com/document/robots/custom-robot-access"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: 'oklch(0.35 0.12 200)' }}
              >
                <ExternalLink size={11} /> 查看钉钉官方文档
              </a>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div
          className="px-6 py-4 flex justify-end shrink-0"
          style={{ borderTop: '1px solid oklch(0.86 0.012 75)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-sm border border-border hover:bg-muted transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
