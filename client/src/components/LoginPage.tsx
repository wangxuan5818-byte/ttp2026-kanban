/*
 * 登录页面 - 纸质战情室风格
 * 用户名 + 密码登录，支持总管理员和各委员会账号
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Lock, User, BookOpen } from "lucide-react";
import Guide from "@/pages/Guide";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const loginMutation = trpc.kanban.login.useMutation({
    onSuccess: () => {
      setErrorMsg("");
      onLoginSuccess();
    },
    onError: (err) => {
      setErrorMsg(err.message || "登录失败，请检查用户名和密码");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("请输入用户名和密码");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'oklch(0.14 0.012 60)',
        backgroundImage: `
          radial-gradient(ellipse at 20% 50%, oklch(0.42 0.18 22 / 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, oklch(0.78 0.12 75 / 0.06) 0%, transparent 40%)
        `,
      }}
    >
      {/* 背景装饰文字 */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <div
          className="text-[20vw] font-bold opacity-[0.03] leading-none"
          style={{ fontFamily: "'Noto Serif SC', serif", color: 'oklch(0.98 0.002 60)' }}
        >
          突围
        </div>
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-16 h-16 rounded-sm items-center justify-center text-3xl font-bold mb-4 shadow-lg"
            style={{ background: 'oklch(0.42 0.18 22)', color: 'oklch(0.98 0.002 60)' }}
          >
            T
          </div>
          <h1
            className="text-2xl font-bold tracking-widest"
            style={{ color: 'oklch(0.88 0.008 75)', fontFamily: "'Noto Serif SC', serif" }}
          >
            TTP2026
          </h1>
          <p className="text-sm mt-1" style={{ color: 'oklch(0.52 0.02 60)' }}>
            AI战略指挥中心 · 三体人突围战
          </p>
        </div>

        {/* 登录卡片 */}
        <div
          className="rounded-sm p-8 shadow-2xl"
          style={{
            background: 'oklch(0.97 0.006 80)',
            border: '1px solid oklch(0.86 0.012 75)',
            boxShadow: '0 20px 60px oklch(0.08 0.01 60 / 0.6)',
          }}
        >
          <div className="mb-6">
            <h2
              className="text-base font-bold text-foreground"
              style={{ fontFamily: "'Noto Serif SC', serif" }}
            >
              身份验证
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              请使用分配的账号登录，部门成员只能查看本部门内容
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 用户名 */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                用户名
              </label>
              <div className="relative">
                <User
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-sm outline-none transition-all"
                  style={{
                    background: 'oklch(0.99 0.003 80)',
                    border: '1px solid oklch(0.82 0.015 75)',
                    color: 'oklch(0.15 0.015 60)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'oklch(0.42 0.18 22)';
                    e.target.style.boxShadow = '0 0 0 2px oklch(0.42 0.18 22 / 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'oklch(0.82 0.015 75)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm rounded-sm outline-none transition-all"
                  style={{
                    background: 'oklch(0.99 0.003 80)',
                    border: '1px solid oklch(0.82 0.015 75)',
                    color: 'oklch(0.15 0.015 60)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'oklch(0.42 0.18 22)';
                    e.target.style.boxShadow = '0 0 0 2px oklch(0.42 0.18 22 / 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'oklch(0.82 0.015 75)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {errorMsg && (
              <div
                className="text-xs px-3 py-2 rounded-sm"
                style={{
                  background: 'oklch(0.97 0.04 22)',
                  border: '1px solid oklch(0.80 0.12 22)',
                  color: 'oklch(0.38 0.18 22)',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-2.5 text-sm font-semibold rounded-sm transition-all duration-200 mt-2"
              style={{
                background: loginMutation.isPending ? 'oklch(0.62 0.12 22)' : 'oklch(0.42 0.18 22)',
                color: 'oklch(0.98 0.002 60)',
                cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!loginMutation.isPending) {
                  (e.target as HTMLButtonElement).style.background = 'oklch(0.38 0.20 22)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loginMutation.isPending) {
                  (e.target as HTMLButtonElement).style.background = 'oklch(0.42 0.18 22)';
                }
              }}
            >
              {loginMutation.isPending ? "验证中..." : "进入指挥中心"}
            </button>
          </form>
        </div>

        {/* 底部说明 + 说明书入口 */}
        <div className="text-center mt-6 text-xs space-y-2" style={{ color: 'oklch(0.38 0.012 60)' }}>
          <p>账号由总管理员统一分配 · 如需帮助请联系管理员</p>
          <button
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-all duration-200 hover:opacity-80"
            style={{ border: '1px solid oklch(0.35 0.015 60 / 0.4)', color: 'oklch(0.55 0.015 60)' }}
          >
            <BookOpen size={12} />
            <span>查看填写说明书 & 看板介绍</span>
          </button>
        </div>
      </div>

      {/* 说明书弹窗 */}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
