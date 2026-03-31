/**
 * 管理员全局编辑器
 * 功能：战略目标编辑、部门信息增删改查、任务增删改查（跨部门视图）
 * 新增：月份选择器、日期选择器、部门状态标注、钉钉通讯录选人
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  X, Edit2, Plus, Trash2, Save, ChevronDown, ChevronRight,
  Target, Users, ListTodo, Settings, RefreshCw, Calendar, Search, Phone
} from "lucide-react";
import { committees as staticCommittees, strategicGoal as staticGoal, monthlyStrategy as staticMonthly } from "@/data/kanbanData";
import type { Committee } from "@/data/kanbanData";

interface GlobalEditorProps {
  onClose: () => void;
}

type EditorTab = "strategic" | "committees" | "tasks";

// ─── 部门状态配置 ──────────────────────────────────────────────
const COMMITTEE_STATUS_OPTIONS = [
  { value: "active", label: "执行中", color: "oklch(0.45 0.18 145)", bg: "oklch(0.45 0.18 145 / 0.1)", border: "oklch(0.45 0.18 145 / 0.3)" },
  { value: "paused", label: "暂缓", color: "oklch(0.55 0.18 60)", bg: "oklch(0.55 0.18 60 / 0.1)", border: "oklch(0.55 0.18 60 / 0.3)" },
  { value: "terminated", label: "终止", color: "oklch(0.42 0.18 22)", bg: "oklch(0.42 0.18 22 / 0.1)", border: "oklch(0.42 0.18 22 / 0.3)" },
] as const;

function getStatusStyle(status?: string) {
  return COMMITTEE_STATUS_OPTIONS.find(o => o.value === status) || COMMITTEE_STATUS_OPTIONS[0];
}

// ─── 月份选择器组件 ───────────────────────────────────────────────
interface MonthPickerProps {
  value: string; // 格式 "YYYY-MM" 或 "YYYY年MM月"
  onChange: (val: string) => void;
  className?: string;
}

function MonthPicker({ value, onChange, className = "" }: MonthPickerProps) {
  // 将各种格式统一转换为 input[type=month] 需要的 YYYY-MM 格式
  const toInputValue = (v: string) => {
    if (!v) return "";
    // 处理 "2026年12月" 格式
    const match = v.match(/(\d{4})年(\d{1,2})月/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}`;
    // 已经是 YYYY-MM 格式
    if (/^\d{4}-\d{2}$/.test(v)) return v;
    return v;
  };

  const fromInputValue = (v: string) => {
    if (!v) return v;
    // 转换为 "YYYY年MM月" 显示格式
    const [year, month] = v.split("-");
    return `${year}年${parseInt(month)}月`;
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="month"
        className="w-full px-3 py-2 border border-border rounded text-sm bg-background pr-8"
        value={toInputValue(value)}
        onChange={e => onChange(fromInputValue(e.target.value))}
      />
      <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ─── 日期选择器组件 ───────────────────────────────────────────────
interface DatePickerProps {
  value: string; // 格式 "YYYY-MM-DD" 或 "YYYY年MM月DD日"
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  showReminder?: boolean;
}

function DatePicker({ value, onChange, placeholder, className = "", showReminder = false }: DatePickerProps) {
  const [showReminderMenu, setShowReminderMenu] = useState(false);

  const toInputValue = (v: string) => {
    if (!v) return "";
    const match = v.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return v;
  };

  const fromInputValue = (v: string) => {
    if (!v) return v;
    const [year, month, day] = v.split("-");
    return `${year}年${parseInt(month)}月${parseInt(day)}日`;
  };

  const addToCalendar = (dateStr: string) => {
    const inputDate = toInputValue(dateStr);
    if (!inputDate) { toast.error("请先选择日期"); return; }
    // 生成 .ics 格式的日历文件
    const dateFormatted = inputDate.replace(/-/g, "");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TTP2026 AI战略看板//CN",
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${dateFormatted}`,
      `DTEND;VALUE=DATE:${dateFormatted}`,
      `SUMMARY:TTP2026 里程碑提醒`,
      `DESCRIPTION:TTP2026 AI战略看板里程碑节点`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ttp2026_milestone_${inputDate}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("日历文件已下载，请导入到日历应用");
    setShowReminderMenu(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-1">
        <div className="relative flex-1">
          <input
            type="date"
            className="w-full px-3 py-2 border border-border rounded text-sm bg-background pr-8"
            value={toInputValue(value)}
            onChange={e => onChange(fromInputValue(e.target.value))}
            placeholder={placeholder}
          />
          <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        {showReminder && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReminderMenu(!showReminderMenu)}
              className="px-2 py-2 border border-border rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
              title="添加日程提醒"
            >
              <Calendar size={12} />
              提醒
            </button>
            {showReminderMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-lg p-3 w-48">
                <p className="text-xs text-muted-foreground mb-2">下载日历文件(.ics)</p>
                <button
                  onClick={() => addToCalendar(value)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Calendar size={12} className="text-primary" />
                  添加到系统日历
                </button>
                <button
                  onClick={() => {
                    const inputDate = toInputValue(value);
                    if (!inputDate) { toast.error("请先选择日期"); return; }
                    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${inputDate.replace(/-/g, "")}/${inputDate.replace(/-/g, "")}&text=TTP2026里程碑提醒`, "_blank");
                    setShowReminderMenu(false);
                  }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Calendar size={12} className="text-blue-500" />
                  添加到 Google 日历
                </button>
                <button
                  onClick={() => setShowReminderMenu(false)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors text-muted-foreground"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 钉钉通讯录选人组件 ────────────────────────────────────────────
interface DingTalkContactPickerProps {
  selectedMembers: string[];
  onChange: (members: string[]) => void;
}

function DingTalkContactPicker({ selectedMembers, onChange }: DingTalkContactPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [manualInput, setManualInput] = useState("");

  // 搜索钉钉通讯录
  const { data: searchResult, isLoading: searching } = trpc.dingtalk.searchContacts.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 1 }
  );

  const addMember = (name: string) => {
    if (!name.trim() || selectedMembers.includes(name.trim())) return;
    onChange([...selectedMembers, name.trim()]);
  };

  const removeMember = (name: string) => {
    onChange(selectedMembers.filter(m => m !== name));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedMembers.map((m, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-accent rounded text-xs">
            <Phone size={10} className="text-muted-foreground" />
            {m}
            <button onClick={() => removeMember(m)} className="text-muted-foreground hover:text-destructive ml-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      {/* 钉钉通讯录搜索 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs hover:bg-accent transition-colors"
          >
            <Search size={12} />
            钉钉通讯录搜索
          </button>
          <div className="flex gap-1 flex-1">
            <input
              className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
              placeholder="手动输入成员姓名..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && manualInput.trim()) {
                  addMember(manualInput);
                  setManualInput("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => { addMember(manualInput); setManualInput(""); }}
              className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="border border-border rounded-lg p-3 bg-muted/20">
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full pl-7 pr-3 py-1.5 border border-border rounded text-sm bg-background"
                placeholder="搜索钉钉通讯录成员..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            {searching && <p className="text-xs text-muted-foreground py-2 text-center">搜索中...</p>}
            {searchResult && searchResult.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {searchResult.map((contact: { name: string; mobile?: string; deptName?: string }, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { addMember(contact.name); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium shrink-0">
                      {contact.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                      {contact.deptName && <p className="text-xs text-muted-foreground truncate">{contact.deptName}</p>}
                    </div>
                    {selectedMembers.includes(contact.name) && (
                      <span className="text-xs text-primary shrink-0">已添加</span>
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 1 && !searching ? (
              <p className="text-xs text-muted-foreground py-2 text-center">未找到匹配成员，可手动输入</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 战略目标编辑 ─────────────────────────────────────────────────
function StrategicEditor() {
  const utils = trpc.useUtils();
  const { data: configs } = trpc.config.getStrategicConfigs.useQuery();
  const upsert = trpc.config.upsertStrategicConfig.useMutation({
    onSuccess: () => {
      utils.config.getStrategicConfigs.invalidate();
      utils.tasks.listAll.invalidate();
      toast.success("战略配置已保存");
    },
    onError: (e) => toast.error(e.message),
  });

  const getConfigValue = (key: string, fallback: unknown) => {
    const found = configs?.find(c => c.configKey === key);
    return found ? found.configValue : fallback;
  };

  const goal = getConfigValue("strategicGoal", staticGoal) as typeof staticGoal;
  const monthly = getConfigValue("monthlyStrategy", staticMonthly) as typeof staticMonthly;

  const [editGoal, setEditGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ ...staticGoal });
  const [pathInput, setPathInput] = useState("");

  const [editMonthly, setEditMonthly] = useState(false);
  const [monthlyForm, setMonthlyForm] = useState([...staticMonthly]);

  const handleSaveGoal = () => {
    upsert.mutate({ key: "strategicGoal", value: goalForm });
    setEditGoal(false);
  };

  const handleSaveMonthly = () => {
    upsert.mutate({ key: "monthlyStrategy", value: monthlyForm });
    setEditMonthly(false);
  };

  return (
    <div className="space-y-6">
      {/* 战略目标 */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Target size={16} className="text-primary" />
            核心战略目标
          </h3>
          <button
            onClick={() => { setGoalForm({ ...goal }); setEditGoal(!editGoal); }}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors flex items-center gap-1"
          >
            <Edit2 size={12} /> {editGoal ? "取消" : "编辑"}
          </button>
        </div>

        {editGoal ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">项目名称</label>
              <input
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm bg-background"
                value={goalForm.projectName}
                onChange={e => setGoalForm(f => ({ ...f, projectName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">目标金额</label>
              <input
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm bg-background"
                value={goalForm.totalTarget}
                onChange={e => setGoalForm(f => ({ ...f, totalTarget: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">战略截止月份</label>
              <MonthPicker
                className="mt-1"
                value={goalForm.deadline}
                onChange={val => setGoalForm(f => ({ ...f, deadline: val }))}
              />
              <p className="text-xs text-muted-foreground mt-1">选择年月即可，精确到月</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">协同体系</label>
              <input
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm bg-background"
                value={goalForm.collaboration}
                onChange={e => setGoalForm(f => ({ ...f, collaboration: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">战略路径</label>
              <div className="space-y-2 mt-1">
                {goalForm.paths.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-1.5 border border-border rounded text-sm bg-background"
                      value={p}
                      onChange={e => setGoalForm(f => ({ ...f, paths: f.paths.map((pp, ii) => ii === i ? e.target.value : pp) }))}
                    />
                    <button
                      onClick={() => setGoalForm(f => ({ ...f, paths: f.paths.filter((_, ii) => ii !== i) }))}
                      className="text-destructive hover:bg-destructive/10 px-2 rounded"
                    ><Trash2 size={12} /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-1.5 border border-border rounded text-sm bg-background"
                    placeholder="新增路径..."
                    value={pathInput}
                    onChange={e => setPathInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && pathInput.trim()) {
                        setGoalForm(f => ({ ...f, paths: [...f.paths, pathInput.trim()] }));
                        setPathInput("");
                      }
                    }}
                  />
                  <button
                    onClick={() => { if (pathInput.trim()) { setGoalForm(f => ({ ...f, paths: [...f.paths, pathInput.trim()] })); setPathInput(""); } }}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
                  ><Plus size={12} /></button>
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveGoal}
              disabled={upsert.isPending}
              className="w-full py-2 bg-primary text-primary-foreground rounded text-sm font-medium flex items-center justify-center gap-2"
            >
              <Save size={14} /> 保存战略目标
            </button>
          </div>
        ) : (
          <div className="text-sm space-y-1 text-muted-foreground">
            <p><span className="text-foreground font-medium">{(goal as typeof staticGoal).projectName}</span> · 目标 {(goal as typeof staticGoal).totalTarget}</p>
            <p>截止：{(goal as typeof staticGoal).deadline} · {(goal as typeof staticGoal).collaboration}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {(goal as typeof staticGoal).paths?.map((p, i) => (
                <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 月度战略 */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ListTodo size={16} className="text-primary" />
            月度战略路径
          </h3>
          <button
            onClick={() => { setMonthlyForm([...(monthly as typeof staticMonthly)]); setEditMonthly(!editMonthly); }}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors flex items-center gap-1"
          >
            <Edit2 size={12} /> {editMonthly ? "取消" : "编辑"}
          </button>
        </div>

        {editMonthly ? (
          <div className="space-y-3">
            {monthlyForm.map((m, i) => (
              <div key={i} className="border border-border rounded p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">月份</label>
                    <MonthPicker
                      value={m.month}
                      onChange={val => setMonthlyForm(f => f.map((mm, ii) => ii === i ? { ...mm, month: val } : mm))}
                    />
                  </div>
                  <button
                    onClick={() => setMonthlyForm(f => f.filter((_, ii) => ii !== i))}
                    className="mt-5 text-destructive hover:bg-destructive/10 px-2 rounded"
                  ><Trash2 size={12} /></button>
                </div>
                <textarea
                  className="w-full px-2 py-1 border border-border rounded text-sm bg-background resize-none"
                  rows={2}
                  placeholder="月度战略重点..."
                  value={m.focus}
                  onChange={e => setMonthlyForm(f => f.map((mm, ii) => ii === i ? { ...mm, focus: e.target.value } : mm))}
                />
              </div>
            ))}
            <button
              onClick={() => setMonthlyForm(f => [...f, { month: "", focus: "" }])}
              className="w-full py-1.5 border border-dashed border-border rounded text-sm text-muted-foreground hover:bg-accent flex items-center justify-center gap-1"
            ><Plus size={12} /> 新增月份</button>
            <button
              onClick={handleSaveMonthly}
              disabled={upsert.isPending}
              className="w-full py-2 bg-primary text-primary-foreground rounded text-sm font-medium flex items-center justify-center gap-2"
            >
              <Save size={14} /> 保存月度战略
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {(monthly as typeof staticMonthly).map((m, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 font-medium text-primary w-20">{m.month}</span>
                <span className="text-muted-foreground">{m.focus}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 部门信息编辑 ───────────────────────────────────────────
function CommitteeInfoEditor() {
  const utils = trpc.useUtils();
  const { data: dbConfigs } = trpc.config.getCommitteeConfigs.useQuery();
  const upsert = trpc.config.upsertCommitteeConfig.useMutation({
    onSuccess: () => {
      utils.config.getCommitteeConfigs.invalidate();
      toast.success("部门配置已保存");
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.config.deleteCommitteeConfig.useMutation({
    onSuccess: () => { utils.config.getCommitteeConfigs.invalidate(); toast.success("已恢复为默认配置"); },
    onError: (e) => toast.error(e.message),
  });
  const create = (trpc.config as any).createCommitteeConfig?.useMutation({
    onSuccess: () => {
      utils.config.getCommitteeConfigs.invalidate();
      toast.success("部门已新建，已同步到左侧栏");
      setShowAddModal(false);
      setNewForm({ shortName: "", fullName: "", icon: "🏢", chairman: "", status: "active" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const delCustom = trpc.config.deleteCommitteeConfig.useMutation({
    onSuccess: () => { utils.config.getCommitteeConfigs.invalidate(); toast.success("自定义部门已删除"); },
    onError: (e) => toast.error(e.message),
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState({ shortName: "", fullName: "", icon: "🏢", chairman: "", status: "active" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Committee> & { id: string; committeeStatus?: string; dingTalkWebhook?: string }>({ id: "" });
  const [respInput, setRespInput] = useState("");
  const [condInput, setCondInput] = useState("");

  const getEffectiveCommittee = (c: Committee) => {
    const dbConfig = dbConfigs?.find(d => d.id === c.id);
    if (!dbConfig) return { ...c, committeeStatus: "active" as const, dingTalkWebhook: "" };
    return {
      ...c,
      shortName: dbConfig.shortName ?? c.shortName,
      fullName: dbConfig.fullName ?? c.fullName,
      color: dbConfig.color ?? c.color,
      icon: dbConfig.icon ?? c.icon,
      chairman: dbConfig.chairman ?? c.chairman,
      director: dbConfig.director ?? c.director,
      members: (dbConfig.members as string[]) ?? c.members,
      responsibility: (dbConfig.responsibility as string[]) ?? c.responsibility,
      annualGoal: dbConfig.annualGoal ?? c.annualGoal,
      conditions: (dbConfig.conditions as string[]) ?? c.conditions,
      rewardPool: dbConfig.rewardPool ?? c.rewardPool,
      committeeStatus: (dbConfig.status ?? "active") as string,
      dingTalkWebhook: dbConfig.dingTalkWebhook ?? "",
    };
  };

  const startEdit = (c: Committee) => {
    const eff = getEffectiveCommittee(c);
    setForm({
      id: eff.id,
      shortName: eff.shortName,
      fullName: eff.fullName,
      color: eff.color,
      icon: eff.icon,
      chairman: eff.chairman,
      director: eff.director,
      members: [...eff.members],
      responsibility: [...eff.responsibility],
      annualGoal: eff.annualGoal,
      conditions: [...(eff.conditions || [])],
      rewardPool: eff.rewardPool,
      committeeStatus: eff.committeeStatus,
      dingTalkWebhook: eff.dingTalkWebhook,
    });
    setEditingId(c.id);
  };

  const handleSave = () => {
    if (!form.id || !form.shortName || !form.fullName || !form.chairman) {
      toast.error("请填写必填字段");
      return;
    }
    upsert.mutate({
      id: form.id,
      shortName: form.shortName!,
      fullName: form.fullName!,
      color: form.color || "#C0392B",
      icon: form.icon || "🏛",
      chairman: form.chairman!,
      director: form.director,
      members: form.members,
      responsibility: form.responsibility,
      annualGoal: form.annualGoal,
      conditions: form.conditions,
      rewardPool: form.rewardPool,
      status: (form.committeeStatus as "active" | "paused" | "terminated") || "active",
      dingTalkWebhook: form.dingTalkWebhook,
    });
  };

  const addToArray = (field: "responsibility" | "conditions", value: string) => {
    if (!value.trim()) return;
    setForm(f => ({ ...f, [field]: [...(f[field] || []), value.trim()] }));
  };

  const removeFromArray = (field: "responsibility" | "conditions", index: number) => {
    setForm(f => ({ ...f, [field]: (f[field] || []).filter((_, i) => i !== index) }));
  };

  // 自定义部门（数据库中存在但静态列表中没有的）
  const staticIds = new Set(staticCommittees.map(c => c.id));
  const customDbDepts = (dbConfigs || []).filter(d => !staticIds.has(d.id));

  return (
    <div className="space-y-3">
      {/* 顶部操作栏 */}
      <div className="flex justify-end gap-2 mb-1">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90"
        >
          <Plus size={12} /> 增加部门
        </button>
      </div>

      {/* 新增部门弹窗 */}
      {showAddModal && (
        <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">新增自定义部门</span>
            <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">部门简称 *</label>
              <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                placeholder="如：法务部" value={newForm.shortName}
                onChange={e => setNewForm(f => ({ ...f, shortName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">图标</label>
              <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                placeholder="🏢" value={newForm.icon}
                onChange={e => setNewForm(f => ({ ...f, icon: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">部门全称 *</label>
            <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
              placeholder="如：集团法务部" value={newForm.fullName}
              onChange={e => setNewForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">主票 *</label>
            <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
              placeholder="负责人姓名" value={newForm.chairman}
              onChange={e => setNewForm(f => ({ ...f, chairman: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!newForm.shortName.trim() || !newForm.fullName.trim() || !newForm.chairman.trim()) {
                  toast.error("请填写必填字段");
                  return;
                }
                create?.mutate({ shortName: newForm.shortName, fullName: newForm.fullName, icon: newForm.icon || "🏢", chairman: newForm.chairman, status: newForm.status });
              }}
              disabled={create?.isPending}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded text-sm font-medium"
            >
              确认新建部门
            </button>
            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-border rounded text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 自定义部门列表 */}
      {customDbDepts.map(d => (
        <div key={d.id} className="border border-dashed border-primary/40 rounded-lg overflow-hidden bg-primary/5">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{(d as any).icon || "🏢"}</span>
              <div>
                <span className="font-medium text-sm">{d.shortName}</span>
                <span className="text-xs text-muted-foreground ml-2">{d.fullName}</span>
              </div>
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">自定义</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (confirm(`确定删除部门「${d.shortName}」？删除后将从左侧栏移除。`)) {
                    delCustom.mutate({ id: d.id });
                  }
                }}
                className="text-xs px-2 py-1 text-destructive border border-destructive/30 rounded hover:bg-destructive/10 flex items-center gap-1"
              >
                <Trash2 size={10} /> 删除部门
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* 静态部门列表 */}
      {staticCommittees.map(c => {
        const eff = getEffectiveCommittee(c);
        const hasDbOverride = dbConfigs?.some(d => d.id === c.id);
        const isEditing = editingId === c.id;
        const statusStyle = getStatusStyle(eff.committeeStatus);

        return (
          <div key={c.id} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-lg">{eff.icon}</span>
                <div>
                  <span className="font-medium text-sm">{eff.shortName}</span>
                  <span className="text-xs text-muted-foreground ml-2">{eff.fullName}</span>
                </div>
                {/* 部门状态标签 */}
                <span
                  className="text-xs px-2 py-0.5 rounded-sm font-medium"
                  style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
                >
                  {statusStyle.label}
                </span>
                {hasDbOverride && (
                  <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">已自定义</span>
                )}
              </div>
              <div className="flex gap-2">
                {hasDbOverride && (
                  <button
                    onClick={() => del.mutate({ id: c.id })}
                    className="text-xs px-2 py-1 text-muted-foreground hover:text-destructive border border-border rounded flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> 恢复默认
                  </button>
                )}
                <button
                  onClick={() => isEditing ? setEditingId(null) : startEdit(c)}
                  className="text-xs px-2 py-1 border border-border rounded hover:bg-accent flex items-center gap-1"
                >
                  <Edit2 size={10} /> {isEditing ? "取消" : "编辑"}
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="p-4 space-y-3 border-t border-border">
                {/* 委员会状态 */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium">部门状态</label>
                  <div className="flex gap-2 mt-1.5">
                    {COMMITTEE_STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, committeeStatus: opt.value }))}
                        className="flex-1 py-1.5 rounded-sm text-xs font-medium transition-all border"
                        style={{
                          color: form.committeeStatus === opt.value ? opt.color : undefined,
                          background: form.committeeStatus === opt.value ? opt.bg : undefined,
                          borderColor: form.committeeStatus === opt.value ? opt.border : undefined,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">简称 *</label>
                    <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                      value={form.shortName || ""} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">图标</label>
                    <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                      value={form.icon || ""} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">全称 *</label>
                  <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                    value={form.fullName || ""} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">主席 *</label>
                    <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                      value={form.chairman || ""} onChange={e => setForm(f => ({ ...f, chairman: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">主任</label>
                    <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                      value={form.director || ""} onChange={e => setForm(f => ({ ...f, director: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">年度目标</label>
                  <textarea className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background resize-none" rows={2}
                    value={form.annualGoal || ""} onChange={e => setForm(f => ({ ...f, annualGoal: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">奖金池说明</label>
                  <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background"
                    value={form.rewardPool || ""} onChange={e => setForm(f => ({ ...f, rewardPool: e.target.value }))} />
                </div>

                {/* 成员 - 使用钉钉通讯录选人 */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium">成员（支持钉钉通讯录搜索）</label>
                  <div className="mt-1.5">
                    <DingTalkContactPicker
                      selectedMembers={form.members || []}
                      onChange={members => setForm(f => ({ ...f, members }))}
                    />
                  </div>
                </div>

                {/* 职责 */}
                <div>
                  <label className="text-xs text-muted-foreground">职责</label>
                  <div className="space-y-1 mt-1 mb-1">
                    {(form.responsibility || []).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-muted-foreground">{r}</span>
                        <button onClick={() => removeFromArray("responsibility", i)} className="text-muted-foreground hover:text-destructive"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background" placeholder="添加职责..."
                      value={respInput} onChange={e => setRespInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { addToArray("responsibility", respInput); setRespInput(""); } }} />
                    <button onClick={() => { addToArray("responsibility", respInput); setRespInput(""); }}
                      className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm"><Plus size={12} /></button>
                  </div>
                </div>

                {/* 奖金条件 */}
                <div>
                  <label className="text-xs text-muted-foreground">奖金条件</label>
                  <div className="space-y-1 mt-1 mb-1">
                    {(form.conditions || []).map((cond, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-muted-foreground">{cond}</span>
                        <button onClick={() => removeFromArray("conditions", i)} className="text-muted-foreground hover:text-destructive"><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background" placeholder="添加条件..."
                      value={condInput} onChange={e => setCondInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { addToArray("conditions", condInput); setCondInput(""); } }} />
                    <button onClick={() => { addToArray("conditions", condInput); setCondInput(""); }}
                      className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm"><Plus size={12} /></button>
                  </div>
                </div>

                {/* 钉钉机器人 Webhook */}
                <div>
                  <label className="text-xs text-muted-foreground">钉钉机器人 Webhook（可选）</label>
                  <input className="w-full mt-1 px-2 py-1.5 border border-border rounded text-sm bg-background font-mono"
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                    value={form.dingTalkWebhook || ""} onChange={e => setForm(f => ({ ...f, dingTalkWebhook: e.target.value }))} />
                </div>

                <button onClick={handleSave} disabled={upsert.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground rounded text-sm font-medium flex items-center justify-center gap-2">
                  <Save size={14} /> 保存部门配置
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 任务全局视图 ─────────────────────────────────────────────
function TasksGlobalView() {
  const utils = trpc.useUtils();
  const { data: allTasks, isLoading } = trpc.tasks.listAll.useQuery();
  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => { utils.tasks.listAll.invalidate(); toast.success("任务已删除"); },
    onError: (e) => toast.error(e.message),
  });
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => { utils.tasks.listAll.invalidate(); toast.success("状态已更新"); },
    onError: (e) => toast.error(e.message),
  });

  const [filterCommittee, setFilterCommittee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const batchUpdateTask = trpc.tasks.update.useMutation({
    onSuccess: () => { utils.tasks.listAll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleBatchEnd = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => batchUpdateTask.mutateAsync({ id, status: '已结束' })));
    toast.success(`已将 ${ids.length} 个任务标记为已结束`);
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const nonEndedIds = filtered.filter(t => t.status !== '已结束').map(t => t.id);
    if (selectedIds.size === nonEndedIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nonEndedIds));
    }
  };

  const statusColors: Record<string, string> = {
    "进行中": "text-blue-600 bg-blue-50",
    "已完成": "text-green-600 bg-green-50",
    "已结束": "text-gray-600 bg-gray-50",
    "待启动": "text-gray-600 bg-gray-50",
    "有卡点": "text-red-600 bg-red-50",
  };

  const filtered = (allTasks || []).filter(t => {
    if (filterCommittee !== "all" && t.committeeId !== filterCommittee) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-4">
      {/* 筛选器 */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="px-3 py-1.5 border border-border rounded text-sm bg-background"
          value={filterCommittee}
          onChange={e => setFilterCommittee(e.target.value)}
        >
          <option value="all">全部部门</option>
          {staticCommittees.map(c => (
            <option key={c.id} value={c.id}>{c.shortName}</option>
          ))}
        </select>
        <select
          className="px-3 py-1.5 border border-border rounded text-sm bg-background"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">全部状态</option>
          <option value="进行中">进行中</option>
          <option value="已结束">已结束</option>
          <option value="待启动">待启动</option>
          <option value="有卡点">有卡点</option>
        </select>
        <span className="text-sm text-muted-foreground self-center">共 {filtered.length} 条任务</span>
        <button
          onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
          className={`ml-auto px-3 py-1.5 text-sm rounded border transition-colors ${batchMode ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}
        >
          {batchMode ? '退出批量' : '批量操作'}
        </button>
      </div>
      {/* 批量操作工具栏 */}
      {batchMode && (
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(t => t.status !== '已结束').length}
            onChange={toggleSelectAll}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 个任务</span>
          <button
            onClick={handleBatchEnd}
            disabled={selectedIds.size === 0 || batchUpdateTask.isPending}
            className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {batchUpdateTask.isPending ? '处理中...' : `批量标记已结束 (${selectedIds.size})`}
          </button>
          <span className="text-xs text-muted-foreground">提示：已结束状态的任务不可选择</span>
        </div>
      )}

      {/* 任务列表 */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          暂无任务数据。各部门可在看板中新建任务，或点击「同步静态数据」初始化。
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const committee = staticCommittees.find(c => c.id === task.committeeId);
            const isExpanded = expandedId === task.id;
            const isSelected = selectedIds.has(task.id);
            const isEnded = task.status === '已结束';
            return (
              <div key={task.id} className={`border rounded-lg overflow-hidden transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    if (batchMode && !isEnded) { toggleSelect(task.id); }
                    else if (!batchMode) { setExpandedId(isExpanded ? null : task.id); }
                  }}
                >
                  {batchMode ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isEnded}
                      onChange={() => !isEnded && toggleSelect(task.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  ) : (
                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  )}
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: (committee?.color || "#888") + "20", color: committee?.color || "#888" }}>
                    {committee?.shortName || task.committeeId}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">{task.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status] || ""}`}>{task.status}</span>
                  <span className="text-xs text-muted-foreground">{task.manager || "—"}</span>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm(`确认删除任务「${task.name}」？`)) deleteTask.mutate({ id: task.id }); }}
                    className="text-muted-foreground hover:text-destructive p-1 rounded"
                  ><Trash2 size={12} /></button>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border bg-muted/10 space-y-3">
                    <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">目标</span>
                        <p className="mt-0.5">{task.goal}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">策略</span>
                        <p className="mt-0.5">{task.strategy}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">修改状态：</span>
                      {["进行中", "待启动", "有卡点", "已结束"].map(s => (
                        <button
                          key={s}
                          onClick={() => updateTask.mutate({ id: task.id, status: s as "进行中" | "已完成" | "待启动" | "有卡点" | "已结束" })}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${task.status === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                        >{s}</button>
                      ))}
                    </div>
                    {task.completionRate !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-muted-foreground">完成度：</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${task.completionRate || 0}%` }} />
                        </div>
                        <span className="text-xs">{task.completionRate || 0}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────
export default function GlobalEditor({ onClose }: GlobalEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>("strategic");

  const tabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: "strategic", label: "战略目标", icon: <Target size={14} /> },
    { id: "committees", label: "部门管理", icon: <Users size={14} /> },
    { id: "tasks", label: "任务管理", icon: <ListTodo size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h2 className="font-semibold text-lg">全局内容管理</h2>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">管理员专属</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-border px-6 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "strategic" && <StrategicEditor />}
          {activeTab === "committees" && <CommitteeInfoEditor />}
          {activeTab === "tasks" && <TasksGlobalView />}
        </div>
      </div>
    </div>
  );
}
