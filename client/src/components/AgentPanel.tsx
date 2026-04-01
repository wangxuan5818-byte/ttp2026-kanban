/**
 * TTP2026 AI Agent 对话面板
 * 支持自然语言操作看板数据，嵌入到主界面右侧
 * 修复：使用 Cookie 认证（credentials: 'include'），不再依赖 Bearer Token
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, X, Loader2, Bot, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ==================== 类型定义 ====================

type MessageRole = "user" | "assistant" | "tool_call";

interface ChatMessage {
  role: MessageRole;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

interface AgentPanelProps {
  onClose: () => void;
  className?: string;
}

// ==================== 工具调用名称映射 ====================

const TOOL_LABELS: Record<string, string> = {
  get_task_stats: "📊 查询任务统计",
  list_tasks: "📋 获取任务列表",
  get_task: "🔍 查看任务详情",
  update_task: "✏️ 更新任务",
  create_task: "➕ 创建任务",
  list_committees: "🏢 获取部门列表",
  diagnose_task: "🧠 AI 任务诊断",
};

// ==================== 流式 SSE 请求（使用 Cookie 认证）====================

async function streamAgentChat(
  messages: { role: string; content: string }[],
  onText: (text: string) => void,
  onToolCall: (name: string, args: Record<string, unknown>) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  try {
    const response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // 使用 Cookie 认证，与主应用一致
      body: JSON.stringify({ messages, stream: true }),
    });

    if (response.status === 401) {
      onError("未登录，请先登录系统");
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      onError(err.detail || `请求失败 (${response.status})`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("无法读取响应流");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "text") {
            onText(event.content);
          } else if (event.type === "tool_call") {
            onToolCall(event.name, event.args || {});
          } else if (event.type === "done") {
            onDone();
            return;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : "网络错误");
  }
}

// ==================== 主组件 ====================

export default function AgentPanel({ onClose, className }: AgentPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentAssistantRef = useRef<string>("");

  // 加载快捷指令建议（使用 Cookie 认证）
  useEffect(() => {
    fetch("/api/agent/suggestions", {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) setSuggestions(data.suggestions || []);
      })
      .catch(() => {});
  }, []);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送消息
  const handleSend = useCallback(
    async (content?: string) => {
      const text = (content ?? input).trim();
      if (!text || isLoading) return;

      setInput("");
      const userMsg: ChatMessage = { role: "user", content: text };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);
      currentAssistantRef.current = "";

      // 添加 AI 回复占位
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const historyForApi = newMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      await streamAgentChat(
        historyForApi,
        // onText
        (text) => {
          currentAssistantRef.current += text;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === "assistant") {
              updated[lastIdx] = { ...updated[lastIdx], content: currentAssistantRef.current };
            }
            return updated;
          });
        },
        // onToolCall
        (name, args) => {
          const label = TOOL_LABELS[name] || `🔧 ${name}`;
          const argsStr = Object.keys(args).length
            ? ` (${Object.entries(args)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")})`
            : "";
          setMessages((prev) => [
            ...prev.slice(0, -1), // 移除空的 assistant 占位
            { role: "tool_call", content: `${label}${argsStr}`, toolName: name, toolArgs: args },
            { role: "assistant", content: "" }, // 重新添加占位
          ]);
        },
        // onDone
        () => {
          setIsLoading(false);
          // 如果最后一条 assistant 消息是空的，移除它
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        },
        // onError
        (err) => {
          setIsLoading(false);
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === "assistant" && !updated[lastIdx].content) {
              updated[lastIdx] = { role: "assistant", content: `❌ 错误：${err}` };
            } else {
              updated.push({ role: "assistant", content: `❌ 错误：${err}` });
            }
            return updated;
          });
        }
      );
    },
    [input, isLoading, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    currentAssistantRef.current = "";
  };

  // ==================== 渲染 ====================

  return (
    <div
      className={cn(
        "flex flex-col h-full border-l",
        className
      )}
      style={{
        background: "oklch(0.99 0.003 80)",
        borderColor: "oklch(0.86 0.012 75)",
        minWidth: 360,
        maxWidth: 480,
        width: 420,
      }}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          background: "oklch(0.42 0.18 22)",
          borderColor: "oklch(0.36 0.16 22)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">突围 AI 助手</div>
            <div className="text-white/60 text-xs">自然语言操作看板</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="清空对话"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
            <div
              className="size-14 rounded-full flex items-center justify-center"
              style={{ background: "oklch(0.42 0.18 22 / 0.1)" }}
            >
              <Bot className="size-7" style={{ color: "oklch(0.42 0.18 22)" }} />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">突围 AI 助手</p>
              <p className="text-xs text-muted-foreground mt-1">
                用自然语言查询和操作战略看板
              </p>
            </div>
            {suggestions.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="size-3" />
                  快捷指令
                </p>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-accent"
                    style={{ borderColor: "oklch(0.86 0.012 75)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role === "tool_call") {
              return (
                <div key={idx} className="flex justify-center">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border"
                    style={{
                      background: "oklch(0.95 0.01 200)",
                      borderColor: "oklch(0.85 0.05 200)",
                      color: "oklch(0.35 0.12 200)",
                    }}
                  >
                    <Loader2 className="size-3 animate-spin" />
                    {msg.content}
                  </div>
                </div>
              );
            }

            if (msg.role === "user") {
              return (
                <div key={idx} className="flex justify-end">
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm text-sm text-white"
                    style={{ background: "oklch(0.42 0.18 22)" }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            }

            // assistant
            return (
              <div key={idx} className="flex gap-2 items-start">
                <div
                  className="size-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center"
                  style={{ background: "oklch(0.42 0.18 22 / 0.12)" }}
                >
                  <Sparkles className="size-3" style={{ color: "oklch(0.42 0.18 22)" }} />
                </div>
                <div
                  className="flex-1 px-3 py-2 rounded-2xl rounded-tl-sm text-sm"
                  style={{
                    background: "oklch(0.96 0.005 80)",
                    border: "1px solid oklch(0.88 0.010 75)",
                  }}
                >
                  {msg.content ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  ) : isLoading && idx === messages.length - 1 ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      <span className="text-xs">思考中...</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 输入区 */}
      <div
        className="shrink-0 p-3 border-t"
        style={{ borderColor: "oklch(0.86 0.012 75)" }}
      >
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入指令，如：查看进行中的任务..."
            className="flex-1 resize-none min-h-9 max-h-28 text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-9 w-9"
            style={{ background: "oklch(0.42 0.18 22)" }}
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
