/**
 * 钉钉通讯录选人弹窗
 * 支持：部门树浏览、成员多选、关键词搜索
 * 模式：member（选人）| dept（选部门）
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  X, Search, ChevronRight, ChevronDown, Users, Building2,
  CheckCircle2, Loader2, AlertCircle, UserCheck,
} from "lucide-react";

// ─── 类型 ─────────────────────────────────────────────────────

interface DingUser {
  userid: string;
  name: string;
  title?: string;
  avatar?: string;
}

interface DingDept {
  dept_id: number;
  name: string;
  parent_id?: number;
}

interface SelectedUser {
  userid: string;
  name: string;
  title?: string;
}

interface SelectedDept {
  dept_id: number;
  name: string;
}

interface DingContactsPickerProps {
  mode: "member" | "dept";
  // 已选中的值（member 模式传 userid 列表，dept 模式传 dept_id 列表）
  selectedUserIds?: string[];
  selectedDeptIds?: number[];
  // 单选模式（负责人）
  singleSelect?: boolean;
  onConfirm: (users: SelectedUser[], depts: SelectedDept[]) => void;
  onClose: () => void;
}

// ─── 部门成员列表子组件 ────────────────────────────────────────

function DeptMemberList({
  deptId,
  deptName,
  selectedUserIds,
  onToggleUser,
}: {
  deptId: number;
  deptName: string;
  selectedUserIds: string[];
  onToggleUser: (user: DingUser) => void;
}) {
  const { data, isLoading, error } = trpc.contacts.getDeptMembers.useQuery(
    { deptId, cursor: 0, size: 50 },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
        <Loader2 size={12} className="animate-spin" /> 加载成员中…
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: 'oklch(0.55 0.18 22)' }}>
        <AlertCircle size={12} />
        {data?.error || error?.message || "加载失败"}
      </div>
    );
  }

  const members = data.list || [];

  if (members.length === 0) {
    return (
      <div className="px-4 py-2 text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
        该部门暂无成员
      </div>
    );
  }

  return (
    <div>
      {members.map(user => {
        const selected = selectedUserIds.includes(user.userid);
        return (
          <button
            key={user.userid}
            onClick={() => onToggleUser(user)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 transition-colors text-left"
          >
            {/* 头像占位 */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: selected ? 'oklch(0.42 0.18 22 / 0.15)' : 'oklch(0.90 0.012 75)',
                color: selected ? 'oklch(0.42 0.18 22)' : 'oklch(0.45 0.015 60)',
              }}
            >
              {user.name.slice(-1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'oklch(0.22 0.015 60)' }}>
                {user.name}
              </div>
              {user.title && (
                <div className="text-[10px] truncate" style={{ color: 'oklch(0.60 0.015 60)' }}>
                  {user.title}
                </div>
              )}
            </div>
            {selected && <CheckCircle2 size={14} style={{ color: 'oklch(0.42 0.18 22)' }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── 部门树节点 ────────────────────────────────────────────────

function DeptTreeNode({
  dept,
  mode,
  selectedUserIds,
  selectedDeptIds,
  onToggleUser,
  onToggleDept,
  depth,
}: {
  dept: DingDept;
  mode: "member" | "dept";
  selectedUserIds: string[];
  selectedDeptIds: number[];
  onToggleUser: (user: DingUser) => void;
  onToggleDept: (dept: DingDept) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const { data: subDepts, isLoading: subLoading } = trpc.contacts.getDepts.useQuery(
    { parentId: dept.dept_id },
    { enabled: expanded, staleTime: 60_000 }
  );

  const hasSubDepts = expanded && subDepts?.depts && subDepts.depts.length > 0;
  const deptSelected = selectedDeptIds.includes(dept.dept_id);

  return (
    <div>
      <div
        className="flex items-center gap-1 hover:bg-black/5 transition-colors"
        style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}
      >
        {/* 展开/折叠箭头 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded-sm hover:bg-black/10 transition-colors shrink-0"
        >
          {subLoading
            ? <Loader2 size={12} className="animate-spin" style={{ color: 'oklch(0.65 0.015 60)' }} />
            : expanded
            ? <ChevronDown size={12} style={{ color: 'oklch(0.55 0.015 60)' }} />
            : <ChevronRight size={12} style={{ color: 'oklch(0.55 0.015 60)' }} />
          }
        </button>

        {/* 部门图标 */}
        <Building2 size={13} className="shrink-0" style={{ color: deptSelected ? 'oklch(0.42 0.18 22)' : 'oklch(0.55 0.015 60)' }} />

        {/* 部门名称 */}
        <button
          className="flex-1 text-left text-sm"
          style={{ color: deptSelected ? 'oklch(0.42 0.18 22)' : 'oklch(0.28 0.015 60)', fontWeight: deptSelected ? 600 : 400 }}
          onClick={() => mode === "dept" ? onToggleDept(dept) : setShowMembers(!showMembers)}
        >
          {dept.name}
        </button>

        {/* 选中标记（部门模式）*/}
        {mode === "dept" && deptSelected && (
          <CheckCircle2 size={13} style={{ color: 'oklch(0.42 0.18 22)' }} />
        )}

        {/* 查看成员按钮（成员模式）*/}
        {mode === "member" && (
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] transition-colors hover:bg-black/10"
            style={{ color: 'oklch(0.55 0.015 60)' }}
          >
            <Users size={10} />
            {showMembers ? "收起" : "查看"}
          </button>
        )}
      </div>

      {/* 成员列表 */}
      {mode === "member" && showMembers && (
        <div style={{ background: 'oklch(0.985 0.005 80)' }}>
          <DeptMemberList
            deptId={dept.dept_id}
            deptName={dept.name}
            selectedUserIds={selectedUserIds}
            onToggleUser={onToggleUser}
          />
        </div>
      )}

      {/* 子部门 */}
      {expanded && hasSubDepts && (
        <div>
          {subDepts!.depts.map(sub => (
            <DeptTreeNode
              key={sub.dept_id}
              dept={sub}
              mode={mode}
              selectedUserIds={selectedUserIds}
              selectedDeptIds={selectedDeptIds}
              onToggleUser={onToggleUser}
              onToggleDept={onToggleDept}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 主弹窗组件 ───────────────────────────────────────────────

export default function DingContactsPicker({
  mode,
  selectedUserIds = [],
  selectedDeptIds = [],
  singleSelect = false,
  onConfirm,
  onClose,
}: DingContactsPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [debouncedKw, setDebouncedKw] = useState("");
  const [localUserIds, setLocalUserIds] = useState<string[]>(selectedUserIds);
  const [localUsers, setLocalUsers] = useState<SelectedUser[]>([]);
  const [localDeptIds, setLocalDeptIds] = useState<number[]>(selectedDeptIds);
  const [localDepts, setLocalDepts] = useState<SelectedDept[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedKw(keyword), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [keyword]);

  // 获取根部门列表
  const { data: rootDepts, isLoading: rootLoading, error: rootError } = trpc.contacts.getDepts.useQuery(
    { parentId: 1 },
    { staleTime: 60_000 }
  );

  // 搜索用户
  const { data: searchResult, isLoading: searchLoading } = trpc.contacts.searchUsers.useQuery(
    { keyword: debouncedKw },
    { enabled: debouncedKw.length >= 1, staleTime: 30_000 }
  );

  const isSearchMode = debouncedKw.length >= 1;

  const toggleUser = (user: DingUser) => {
    if (singleSelect) {
      setLocalUserIds([user.userid]);
      setLocalUsers([{ userid: user.userid, name: user.name, title: user.title }]);
      return;
    }
    if (localUserIds.includes(user.userid)) {
      setLocalUserIds(prev => prev.filter(id => id !== user.userid));
      setLocalUsers(prev => prev.filter(u => u.userid !== user.userid));
    } else {
      setLocalUserIds(prev => [...prev, user.userid]);
      setLocalUsers(prev => [...prev, { userid: user.userid, name: user.name, title: user.title }]);
    }
  };

  const toggleDept = (dept: DingDept) => {
    if (localDeptIds.includes(dept.dept_id)) {
      setLocalDeptIds(prev => prev.filter(id => id !== dept.dept_id));
      setLocalDepts(prev => prev.filter(d => d.dept_id !== dept.dept_id));
    } else {
      setLocalDeptIds(prev => [...prev, dept.dept_id]);
      setLocalDepts(prev => [...prev, { dept_id: dept.dept_id, name: dept.name }]);
    }
  };

  const handleConfirm = () => {
    onConfirm(localUsers, localDepts);
    onClose();
  };

  const selectedCount = mode === "member" ? localUserIds.length : localDeptIds.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'oklch(0.08 0.01 60 / 0.55)' }}
    >
      <div
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-sm overflow-hidden"
        style={{
          background: 'oklch(0.975 0.008 80)',
          border: '1px solid oklch(0.82 0.015 75)',
          boxShadow: '0 20px 60px oklch(0.08 0.01 60 / 0.4)',
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid oklch(0.88 0.012 75)', background: 'oklch(0.965 0.01 80)' }}
        >
          <div className="flex items-center gap-2">
            {mode === "dept"
              ? <Building2 size={14} style={{ color: 'oklch(0.42 0.18 22)' }} />
              : <UserCheck size={14} style={{ color: 'oklch(0.42 0.18 22)' }} />
            }
            <span className="text-sm font-semibold" style={{ fontFamily: "'Noto Serif SC', serif", color: 'oklch(0.22 0.015 60)' }}>
              {mode === "dept" ? "选择参与部门" : singleSelect ? "选择负责人" : "选择协作成员"}
            </span>
            {selectedCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
              >
                已选 {selectedCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-black/10 transition-colors">
            <X size={14} style={{ color: 'oklch(0.55 0.015 60)' }} />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid oklch(0.90 0.010 75)' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'oklch(0.65 0.015 60)' }} />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder={mode === "dept" ? "搜索部门名称…" : "搜索姓名或职务…"}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-sm outline-none"
              style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
              autoFocus
            />
          </div>
        </div>

        {/* 已选标签（成员模式） */}
        {mode === "member" && localUsers.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 px-4 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid oklch(0.90 0.010 75)', background: 'oklch(0.97 0.008 80)' }}
          >
            {localUsers.map(u => (
              <span
                key={u.userid}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'oklch(0.42 0.18 22 / 0.1)', color: 'oklch(0.42 0.18 22)', border: '1px solid oklch(0.42 0.18 22 / 0.3)' }}
              >
                {u.name}
                <button onClick={() => toggleUser({ userid: u.userid, name: u.name, title: u.title })}>
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 已选标签（部门模式） */}
        {mode === "dept" && localDepts.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 px-4 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid oklch(0.90 0.010 75)', background: 'oklch(0.97 0.008 80)' }}
          >
            {localDepts.map(d => (
              <span
                key={d.dept_id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'oklch(0.45 0.15 250 / 0.1)', color: 'oklch(0.45 0.15 250)', border: '1px solid oklch(0.45 0.15 250 / 0.3)' }}
              >
                {d.name}
                <button onClick={() => toggleDept({ dept_id: d.dept_id, name: d.name })}>
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {/* 搜索结果（仅成员模式） */}
          {isSearchMode && mode === "member" && (
            <div>
              {searchLoading && (
                <div className="flex items-center gap-2 px-4 py-4 text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
                  <Loader2 size={12} className="animate-spin" /> 搜索中…
                </div>
              )}
              {!searchLoading && searchResult && (
                <>
                  {searchResult.success && searchResult.users.length > 0 ? (
                    searchResult.users.map(user => {
                      const selected = localUserIds.includes(user.userid);
                      return (
                        <button
                          key={user.userid}
                          onClick={() => toggleUser(user)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 transition-colors text-left"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: selected ? 'oklch(0.42 0.18 22 / 0.15)' : 'oklch(0.90 0.012 75)',
                              color: selected ? 'oklch(0.42 0.18 22)' : 'oklch(0.45 0.015 60)',
                            }}
                          >
                            {user.name.slice(-1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium" style={{ color: 'oklch(0.22 0.015 60)' }}>
                              {user.name}
                            </div>
                            {user.title && (
                              <div className="text-[10px] truncate" style={{ color: 'oklch(0.60 0.015 60)' }}>
                                {user.title}
                              </div>
                            )}
                          </div>
                          {selected && <CheckCircle2 size={14} style={{ color: 'oklch(0.42 0.18 22)' }} />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-6 text-center text-sm" style={{ color: 'oklch(0.65 0.015 60)' }}>
                      {searchResult.success ? "未找到匹配成员" : `搜索失败：${searchResult.error}`}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 部门搜索（部门模式） */}
          {isSearchMode && mode === "dept" && (
            <div>
              {rootDepts?.depts
                .filter(d => d.name.includes(debouncedKw))
                .map(dept => {
                  const selected = localDeptIds.includes(dept.dept_id);
                  return (
                    <button
                      key={dept.dept_id}
                      onClick={() => toggleDept(dept)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/5 transition-colors text-left"
                    >
                      <Building2 size={13} style={{ color: selected ? 'oklch(0.42 0.18 22)' : 'oklch(0.55 0.015 60)' }} />
                      <span className="flex-1 text-sm" style={{ color: 'oklch(0.22 0.015 60)', fontWeight: selected ? 600 : 400 }}>
                        {dept.name}
                      </span>
                      {selected && <CheckCircle2 size={13} style={{ color: 'oklch(0.42 0.18 22)' }} />}
                    </button>
                  );
                })}
            </div>
          )}

          {/* 部门树（非搜索模式） */}
          {!isSearchMode && (
            <div>
              {rootLoading && (
                <div className="flex items-center gap-2 px-4 py-6 text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
                  <Loader2 size={14} className="animate-spin" /> 加载组织架构…
                </div>
              )}
              {rootError && (
                <div className="flex items-center gap-2 px-4 py-4 text-xs" style={{ color: 'oklch(0.55 0.18 22)' }}>
                  <AlertCircle size={13} />
                  {rootError.message}
                </div>
              )}
              {rootDepts && !rootDepts.success && (
                <div className="px-4 py-4 text-xs" style={{ color: 'oklch(0.55 0.18 22)' }}>
                  <AlertCircle size={13} className="inline mr-1" />
                  {rootDepts.error || "获取部门失败，请检查钉钉应用权限"}
                </div>
              )}
              {rootDepts?.success && rootDepts.depts.length === 0 && (
                <div className="px-4 py-6 text-center text-sm" style={{ color: 'oklch(0.65 0.015 60)' }}>
                  暂无部门数据
                </div>
              )}
              {rootDepts?.success && rootDepts.depts.map(dept => (
                <DeptTreeNode
                  key={dept.dept_id}
                  dept={dept}
                  mode={mode}
                  selectedUserIds={localUserIds}
                  selectedDeptIds={localDeptIds}
                  onToggleUser={toggleUser}
                  onToggleDept={toggleDept}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid oklch(0.88 0.012 75)', background: 'oklch(0.965 0.01 80)' }}
        >
          <span className="text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
            {selectedCount > 0
              ? `已选 ${selectedCount} ${mode === "dept" ? "个部门" : "人"}`
              : mode === "dept" ? "请选择部门" : singleSelect ? "请选择负责人" : "请选择成员"
            }
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded-sm transition-colors hover:bg-black/5"
              style={{ color: 'oklch(0.45 0.015 60)' }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-1.5 text-xs rounded-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
            >
              确认选择
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
