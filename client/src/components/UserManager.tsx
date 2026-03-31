/*
 * 账号管理界面 - 管理员专用
 * 支持：创建账号、重置密码、修改角色/委员会、删除账号
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Trash2, Edit2, X, Check, Eye, EyeOff,
  Shield, Users, ChevronDown
} from "lucide-react";
import { committees } from "@/data/kanbanData";

type KanbanUser = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  committeeId: string | null;
};

interface UserManagerProps {
  onClose: () => void;
}

export default function UserManager({ onClose }: UserManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [resetingId, setResetingId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);

  // 创建表单状态
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "committee" as "admin" | "committee",
    committeeId: "" as string | null,
  });
  const [showPwd, setShowPwd] = useState(false);

  // 编辑表单状态
  const [editForm, setEditForm] = useState<{
    displayName: string;
    role: "admin" | "committee";
    committeeId: string | null;
  }>({ displayName: "", role: "committee", committeeId: null });

  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.kanban.listUsers.useQuery();

  const createMutation = trpc.kanban.createUser.useMutation({
    onSuccess: () => {
      utils.kanban.listUsers.invalidate();
      setShowCreateForm(false);
      setForm({ username: "", password: "", displayName: "", role: "committee", committeeId: "" });
      toast.success("账号创建成功");
    },
    onError: (err) => toast.error(`创建失败：${err.message}`),
  });

  const updateMutation = trpc.kanban.updateUser.useMutation({
    onSuccess: () => {
      utils.kanban.listUsers.invalidate();
      setEditingId(null);
      toast.success("账号信息已更新");
    },
    onError: (err) => toast.error(`更新失败：${err.message}`),
  });

  const resetPwdMutation = trpc.kanban.resetPassword.useMutation({
    onSuccess: () => {
      utils.kanban.listUsers.invalidate();
      setResetingId(null);
      setNewPassword("");
      toast.success("密码已重置");
    },
    onError: (err) => toast.error(`重置失败：${err.message}`),
  });

  const deleteMutation = trpc.kanban.deleteUser.useMutation({
    onSuccess: () => {
      utils.kanban.listUsers.invalidate();
      toast.success("账号已删除");
    },
    onError: (err) => toast.error(`删除失败：${err.message}`),
  });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.displayName) {
      toast.error("请填写完整信息");
      return;
    }
    if (form.role === "committee" && !form.committeeId) {
      toast.error("委员会账号必须选择所属委员会");
      return;
    }
    createMutation.mutate({
      ...form,
      committeeId: form.role === "admin" ? null : form.committeeId,
    });
  };

  const handleEdit = (user: KanbanUser) => {
    setEditingId(user.id);
    setEditForm({
      displayName: user.displayName,
      role: user.role as "admin" | "committee",
      committeeId: user.committeeId,
    });
  };

  const handleSaveEdit = (id: number) => {
    updateMutation.mutate({
      id,
      displayName: editForm.displayName,
      role: editForm.role,
      committeeId: editForm.role === "admin" ? null : editForm.committeeId,
    });
  };

  const handleDelete = (user: KanbanUser) => {
    if (!confirm(`确认删除账号「${user.displayName}（${user.username}）」？`)) return;
    deleteMutation.mutate({ id: user.id });
  };

  const handleResetPassword = (id: number) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("新密码至少6位");
      return;
    }
    resetPwdMutation.mutate({ id, newPassword });
  };

  const getCommitteeName = (id: string | null) => {
    if (!id) return "—";
    return committees.find(c => c.id === id)?.shortName || id;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-sm shadow-2xl"
        style={{ background: 'oklch(0.975 0.008 80)', border: '1px solid oklch(0.86 0.012 75)' }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            background: 'oklch(0.18 0.02 22)',
            borderBottom: '1px solid oklch(0.86 0.012 75)',
          }}
        >
          <div className="flex items-center gap-3">
            <Shield size={18} style={{ color: 'oklch(0.78 0.10 75)' }} />
            <h2 className="text-base font-bold" style={{ color: 'oklch(0.975 0.008 80)', fontFamily: "'Noto Serif SC', serif" }}>
              账号管理中心
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-sm" style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}>
              管理员专用
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm font-medium"
              style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
            >
              <Plus size={12} /> 新建账号
            </button>
            <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-white/10 transition-colors">
              <X size={16} style={{ color: 'oklch(0.78 0.10 75)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 创建账号表单 */}
          {showCreateForm && (
            <div
              className="p-4 rounded-sm"
              style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.78 0.10 75)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'oklch(0.42 0.18 22)', fontFamily: "'Noto Serif SC', serif" }}>
                新建账号
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">用户名 *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="登录用户名（英文）"
                    className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">显示名称 *</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    placeholder="如：前线委员会"
                    className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">初始密码 *（至少6位）</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="至少6位"
                      className="w-full px-3 py-2 pr-9 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {showPwd ? <EyeOff size={14} className="text-muted-foreground" /> : <Eye size={14} className="text-muted-foreground" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">账号角色 *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as "admin" | "committee" }))}
                    className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                  >
                    <option value="committee">委员会账号</option>
                    <option value="admin">管理员账号</option>
                  </select>
                </div>
                {form.role === "committee" && (
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">所属委员会 *</label>
                    <select
                      value={form.committeeId || ""}
                      onChange={e => setForm(f => ({ ...f, committeeId: e.target.value || null }))}
                      className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-[oklch(0.42_0.18_22)]"
                    >
                      <option value="">请选择委员会</option>
                              {committees.map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.shortName}</option>
                              ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-sm font-medium disabled:opacity-50"
                  style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
                >
                  <Check size={12} /> {createMutation.isPending ? "创建中..." : "确认创建"}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-xs rounded-sm border border-border hover:bg-muted transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 账号列表 */}
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">加载中...</div>
          ) : (
            <div className="space-y-2">
              {(users || []).map(user => (
                <div
                  key={user.id}
                  className="rounded-sm overflow-hidden"
                  style={{ border: '1px solid oklch(0.86 0.012 75)' }}
                >
                  {/* 用户行 */}
                  <div
                    className="flex items-center gap-4 px-4 py-3"
                    style={{ background: editingId === user.id ? 'oklch(0.97 0.004 80)' : 'white' }}
                  >
                    {/* 头像 */}
                    <div
                      className="w-9 h-9 rounded-sm flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: user.role === "admin" ? 'oklch(0.42 0.18 22)' : 'oklch(0.94 0.008 75)',
                        color: user.role === "admin" ? 'white' : 'oklch(0.35 0.015 60)',
                      }}
                    >
                      {user.displayName.slice(-1)}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-sm font-mono"
                          style={{
                            background: user.role === "admin" ? 'oklch(0.95 0.05 22)' : 'oklch(0.94 0.008 75)',
                            color: user.role === "admin" ? 'oklch(0.42 0.18 22)' : 'oklch(0.52 0.015 60)',
                          }}
                        >
                          {user.role === "admin" ? "管理员" : "委员会"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">@{user.username}</span>
                        {user.committeeId && (
                          <span className="text-xs text-muted-foreground">
                            {getCommitteeName(user.committeeId)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => editingId === user.id ? setEditingId(null) : handleEdit(user)}
                        className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                        title="编辑"
                      >
                        <Edit2 size={13} style={{ color: 'oklch(0.45 0.015 60)' }} />
                      </button>
                      <button
                        onClick={() => setResetingId(resetingId === user.id ? null : user.id)}
                        className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                        title="重置密码"
                      >
                        <RefreshCw size={13} style={{ color: 'oklch(0.35 0.12 200)' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 rounded-sm hover:bg-red-50 transition-colors"
                        title="删除账号"
                      >
                        <Trash2 size={13} style={{ color: 'oklch(0.55 0.18 22)' }} />
                      </button>
                    </div>
                  </div>

                  {/* 编辑表单 */}
                  {editingId === user.id && (
                    <div
                      className="px-4 py-3 border-t"
                      style={{ background: 'oklch(0.97 0.004 80)', borderColor: 'oklch(0.86 0.012 75)' }}
                    >
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">显示名称</label>
                          <input
                            type="text"
                            value={editForm.displayName}
                            onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                            className="w-full px-2 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">角色</label>
                          <select
                            value={editForm.role}
                            onChange={e => setEditForm(f => ({ ...f, role: e.target.value as "admin" | "committee" }))}
                            className="w-full px-2 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
                          >
                            <option value="committee">委员会账号</option>
                            <option value="admin">管理员账号</option>
                          </select>
                        </div>
                        {editForm.role === "committee" && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">所属委员会</label>
                            <select
                              value={editForm.committeeId || ""}
                              onChange={e => setEditForm(f => ({ ...f, committeeId: e.target.value || null }))}
                              className="w-full px-2 py-1.5 text-xs rounded-sm border border-border bg-background focus:outline-none"
                            >
                              <option value="">请选择</option>
                              {committees.map(c => (
                                <option key={c.id} value={c.id}>{c.shortName}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleSaveEdit(user.id)}
                          disabled={updateMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm font-medium disabled:opacity-50"
                          style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
                        >
                          <Check size={11} /> 保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 重置密码表单 */}
                  {resetingId === user.id && (
                    <div
                      className="px-4 py-3 border-t"
                      style={{ background: 'oklch(0.97 0.004 80)', borderColor: 'oklch(0.86 0.012 75)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">新密码（至少6位）</label>
                          <div className="relative">
                            <input
                              type={showNewPwd ? "text" : "password"}
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              placeholder="输入新密码"
                              className="w-full px-2 py-1.5 pr-8 text-xs rounded-sm border border-border bg-background focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPwd(!showNewPwd)}
                              className="absolute right-2 top-1/2 -translate-y-1/2"
                            >
                              {showNewPwd ? <EyeOff size={12} className="text-muted-foreground" /> : <Eye size={12} className="text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            disabled={resetPwdMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm font-medium disabled:opacity-50"
                            style={{ background: 'oklch(0.35 0.12 200)', color: 'white' }}
                          >
                            <RefreshCw size={11} /> {resetPwdMutation.isPending ? "重置中..." : "确认重置"}
                          </button>
                          <button
                            onClick={() => { setResetingId(null); setNewPassword(""); }}
                            className="px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-muted"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 默认账号说明 */}
          <div
            className="p-3 rounded-sm text-xs"
            style={{ background: 'oklch(0.97 0.004 80)', border: '1px dashed oklch(0.86 0.012 75)' }}
          >
            <div className="font-medium mb-1" style={{ color: 'oklch(0.45 0.015 60)' }}>默认账号规则</div>
            <div className="text-muted-foreground space-y-0.5">
              <div>管理员：<span className="font-mono">admin</span> / <span className="font-mono">ttp2026admin</span></div>
              <div>委员会账号：<span className="font-mono">委员会ID</span> / <span className="font-mono">ttp2026@委员会ID</span>（首次登录后请及时修改密码）</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
