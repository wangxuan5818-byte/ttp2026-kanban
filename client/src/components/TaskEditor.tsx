/**
 * 任务编辑器组件
 * 支持：新建/编辑任务、钉钉选人（模拟）、图片上传产出、完成度滑块、AI积分核算
 */
import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  X, Plus, Trash2, Upload, Image, Users, Building2,
  ChevronDown, ChevronUp, Loader2, Sparkles, CheckCircle2,
  AlertCircle, Clock, TrendingUp, DollarSign, Target
} from "lucide-react";
import { toast } from "sonner";
import DingContactsPicker from "@/components/DingContactsPicker";

// ─

// ─── 类型定义 ─────────────────────────────────────────────────
interface TaskFormData {
  name: string;
  goal: string;
  strategy: string;
  actions: string[];
  milestone: string;
  result: string;
  breakthrough: string;
  manager: string;
  managerUserId: string;
  contributors: string[];
  contributorUserIds: string[];
  dingDeptIds: string[];
  deadline: string;
  status: "进行中" | "已完成" | "待启动" | "有卡点" | "已结束";
  rewardPool: string;
  inputManDays: number | undefined;
  outputValue: number | undefined;
  completionRate: number;
}

interface TaskEditorProps {
  committeeId: string;
  taskId?: string; // 编辑时传入
  initialData?: Partial<TaskFormData>;
  isAiRecognized?: boolean; // 是否来自图片识别
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = ["待启动", "进行中", "有卡点", "已结束"] as const;
const STATUS_COLORS: Record<string, string> = {
  "进行中": "oklch(0.55 0.18 145)",
  "已完成": "oklch(0.45 0.15 250)",
  "待启动": "oklch(0.55 0.015 60)",
  "有卡点": "oklch(0.55 0.18 22)",
  "已结束": "oklch(0.45 0.015 60)",
};

export default function TaskEditor({ committeeId, taskId, initialData, isAiRecognized, onClose, onSaved }: TaskEditorProps) {
  const isEdit = !!taskId;
  const utils = trpc.useUtils();

  // ─── 表单状态 ──────────────────────────────────────────────
  const [form, setForm] = useState<TaskFormData>({
    name: initialData?.name || "",
    goal: initialData?.goal || "",
    strategy: initialData?.strategy || "",
    actions: initialData?.actions || [""],
    milestone: initialData?.milestone || "",
    result: initialData?.result || "",
    breakthrough: initialData?.breakthrough || "",
    manager: initialData?.manager || "",
    managerUserId: (initialData as any)?.managerUserId || "",
    contributors: initialData?.contributors || [],
    contributorUserIds: (initialData as any)?.contributorUserIds || [],
    dingDeptIds: initialData?.dingDeptIds || [],
    deadline: initialData?.deadline || "",
    status: (initialData?.status as any) || "待启动",
    rewardPool: initialData?.rewardPool || "",
    inputManDays: initialData?.inputManDays,
    outputValue: initialData?.outputValue,
    completionRate: initialData?.completionRate || 0,
  });

  const [activeSection, setActiveSection] = useState<string>("basic");
  const [deptNameMap, setDeptNameMap] = useState<Record<string, string>>({});
  const [showDingPicker, setShowDingPicker] = useState<"dept" | "member" | "manager" | "mentor" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<any>(null);
  const [mentorLevel, setMentorLevel] = useState<string>("未参与");
  const [mentorName, setMentorName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 效益核算状态 ──────────────────────────────────────────────────────────
  const OUTCOME_UNITS = ["小时/次", "天/次", "元/次", "元/月", "元/年", "个/天", "个/月", "次/天", "次/月", "人/次"];
  const [outcomeForm, setOutcomeForm] = useState({
    type: "提效" as "提效" | "降本" | "增收",
    scenario: "",
    beforeValue: "",
    afterValue: "",
    unit: "小时/次",
    frequency: "1",
    remark: "",
  });
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);

  // ─── 附件查询 ──────────────────────────────────────────────
  const { data: attachments, refetch: refetchAttachments } = trpc.tasks.getAttachments.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId }
  );

  // ─── 积分查询 ──────────────────────────────────────────────
  const { data: existingScore } = trpc.tasks.getScore.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId }
  );

  // ─── Mutations ────────────────────────────────────────────
  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ committeeId });
      toast.success("任务创建成功");
      onSaved();
    },
    onError: (err) => toast.error(`创建失败：${err.message}`),
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ committeeId });
      toast.success("任务更新成功");
      onSaved();
    },
    onError: (err) => toast.error(`更新失败：${err.message}`),
  });

  const uploadMutation = trpc.tasks.uploadAttachment.useMutation({
    onSuccess: () => {
      refetchAttachments();
      toast.success("附件上传成功");
    },
    onError: (err) => toast.error(`上传失败：${err.message}`),
  });

  const deleteAttachmentMutation = trpc.tasks.deleteAttachment.useMutation({
    onSuccess: () => {
      refetchAttachments();
      toast.success("附件已删除");
    },
  });

  const scoreMutation = trpc.tasks.calculateScore.useMutation({
    onSuccess: (data) => {
      setScoreResult(data);
      setScoring(false);
      toast.success("AI 积分核算完成");
    },
    onError: (err) => {
      setScoring(false);
      toast.error(`核算失败：${err.message}`);
    },
  });

  // ─── 效益核算 Mutations ───────────────────────────────────────────────────
  const { data: outcomeList, refetch: refetchOutcomes } = trpc.outcomes.list.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId }
  );
  const createOutcomeMutation = trpc.outcomes.create.useMutation({
    onSuccess: () => {
      refetchOutcomes();
      setOutcomeForm({ type: "提效", scenario: "", beforeValue: "", afterValue: "", unit: "小时/次", frequency: "1", remark: "" });
      setOutcomeSubmitting(false);
      toast.success("效益记录已添加");
    },
    onError: (err) => { setOutcomeSubmitting(false); toast.error(`添加失败：${err.message}`); },
  });
  const deleteOutcomeMutation = trpc.outcomes.delete.useMutation({
    onSuccess: () => { refetchOutcomes(); toast.success("已删除"); },
  });

  const handleAddOutcome = () => {
    if (!taskId) { toast.error("请先保存任务"); return; }
    if (!outcomeForm.scenario.trim()) { toast.error("请填写场景描述"); return; }
    const bv = parseFloat(outcomeForm.beforeValue);
    const av = parseFloat(outcomeForm.afterValue);
    if (isNaN(bv) || isNaN(av)) { toast.error("请填写有效的前后数值"); return; }
    setOutcomeSubmitting(true);
    createOutcomeMutation.mutate({
      taskId,
      committeeId,
      type: outcomeForm.type,
      scenario: outcomeForm.scenario,
      beforeValue: bv,
      afterValue: av,
      unit: outcomeForm.unit,
      frequency: parseFloat(outcomeForm.frequency) || 1,
      remark: outcomeForm.remark,
    });
  };

  // ─── 表单操作 ──────────────────────────────────────────────────────────
  const updateField = (field: keyof TaskFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateAction = (idx: number, value: string) => {
    const newActions = [...form.actions];
    newActions[idx] = value;
    setForm(prev => ({ ...prev, actions: newActions }));
  };

  const addAction = () => setForm(prev => ({ ...prev, actions: [...prev.actions, ""] }));
  const removeAction = (idx: number) => setForm(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== idx) }));

  // 钉钉选人回调
  const handleDingConfirm = (
    users: { userid: string; name: string; title?: string }[],
    depts: { dept_id: number; name: string }[]
  ) => {
    if (showDingPicker === "mentor" && users.length > 0) {
      setMentorName(users[0].name);
    } else if (showDingPicker === "manager" && users.length > 0) {
      setForm(prev => ({
        ...prev,
        manager: users[0].name,
        managerUserId: users[0].userid,
      }));
    } else if (showDingPicker === "member") {
      const names = users.map(u => u.name);
      const userIds = users.map(u => u.userid);
      setForm(prev => ({
        ...prev,
        contributors: Array.from(new Set([...prev.contributors, ...names])),
        contributorUserIds: Array.from(new Set([...prev.contributorUserIds, ...userIds])),
      }));
    } else if (showDingPicker === "dept") {
      const ids = depts.map(d => String(d.dept_id));
      const newDeptNames = depts.reduce((acc, d) => {
        acc[String(d.dept_id)] = d.name;
        return acc;
      }, {} as Record<string, string>);
      setDeptNameMap(prev => ({ ...prev, ...newDeptNames }));
      setForm(prev => ({
        ...prev,
        dingDeptIds: Array.from(new Set([...prev.dingDeptIds, ...ids])),
      }));
    }
  };

  const toggleDept = (deptId: string) => {
    setForm(prev => ({
      ...prev,
      dingDeptIds: prev.dingDeptIds.includes(deptId)
        ? prev.dingDeptIds.filter(d => d !== deptId)
        : [...prev.dingDeptIds, deptId],
    }));
  };

  const toggleMember = (name: string) => {
    setForm(prev => ({
      ...prev,
      contributors: prev.contributors.includes(name)
        ? prev.contributors.filter(m => m !== name)
        : [...prev.contributors, name],
    }));
  };

  // ─── 文件上传 ──────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !taskId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} 超过 10MB 限制`); continue; }
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = async (ev) => {
          const base64 = (ev.target?.result as string).split(",")[1];
          await uploadMutation.mutateAsync({
            taskId,
            committeeId,
            filename: file.name,
            mimeType: file.type,
            base64Data: base64,
            fileSize: file.size,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [taskId, committeeId]);

  // ─── 提交 ─────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("请填写任务名称"); return; }
    if (!form.goal.trim()) { toast.error("请填写任务目标"); return; }
    const payload = {
      ...form,
      actions: form.actions.filter(a => a.trim()),
      committeeId,
    };
    if (isEdit) {
      updateMutation.mutate({ id: taskId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── 渲染 ─────────────────────────────────────────────────
  const sections = [
    { id: "basic", label: "基本信息", icon: Target },
    { id: "plan", label: "行动计划", icon: CheckCircle2 },
    { id: "progress", label: "进展产出", icon: TrendingUp },
    { id: "team", label: "团队协作", icon: Users },
    { id: "outcome", label: "效益核算", icon: DollarSign },
    { id: "score", label: "积分核算", icon: Sparkles },
  ];

  const displayScore = scoreResult || existingScore;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'oklch(0.08 0.01 60 / 0.85)' }}>
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-sm overflow-hidden"
        style={{ background: 'oklch(0.975 0.008 80)', border: '1px solid oklch(0.82 0.015 75)', boxShadow: '0 20px 60px oklch(0.08 0.01 60 / 0.5)' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid oklch(0.88 0.012 75)', background: 'oklch(0.965 0.01 80)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Noto Serif SC', serif", color: 'oklch(0.22 0.015 60)' }}>
              {isEdit ? "编辑任务" : "新建任务"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.015 60)' }}>委员会：{committeeId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors">
            <X size={16} style={{ color: 'oklch(0.45 0.015 60)' }} />
          </button>
        </div>

        {/* AI 识别提示横幅 */}
        {isAiRecognized && !taskId && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 shrink-0 text-xs"
            style={{
              background: 'oklch(0.95 0.06 200)',
              borderBottom: '1px solid oklch(0.80 0.10 200)',
              color: 'oklch(0.28 0.10 200)',
            }}
          >
            <span style={{ fontSize: 14 }}>🤖</span>
            <span className="font-medium">内容由 AI 识别生成，请核对后保存</span>
            <span className="ml-auto opacity-60">识别结果仅供参考，建议逐项检查</span>
          </div>
        )}

        {/* 标签导航 */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid oklch(0.88 0.012 75)' }}>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-150"
              style={{
                color: activeSection === id ? 'oklch(0.42 0.18 22)' : 'oklch(0.55 0.015 60)',
                borderBottom: activeSection === id ? '2px solid oklch(0.42 0.18 22)' : '2px solid transparent',
                background: activeSection === id ? 'oklch(0.97 0.01 80)' : 'transparent',
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── 基本信息 ── */}
          {activeSection === "basic" && (
            <div className="space-y-4">
              <Field label="任务名称 *">
                <input
                  value={form.name}
                  onChange={e => updateField("name", e.target.value)}
                  placeholder="请输入任务名称"
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>
              <Field label="任务目标 *">
                <textarea
                  value={form.goal}
                  onChange={e => updateField("goal", e.target.value)}
                  placeholder="描述本任务要达成的具体目标"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none resize-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>
              <Field label="核心策略">
                <textarea
                  value={form.strategy}
                  onChange={e => updateField("strategy", e.target.value)}
                  placeholder="实现目标的核心策略和方法"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none resize-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="任务状态">
                  <select
                    value={form.status}
                    onChange={e => updateField("status", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: STATUS_COLORS[form.status] || 'oklch(0.22 0.015 60)' }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="截止日期">
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => updateField("deadline", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                  />
                </Field>
              </div>
              <Field label="里程碑">
                <input
                  value={form.milestone}
                  onChange={e => updateField("milestone", e.target.value)}
                  placeholder="关键里程碑节点"
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>
              <Field label="奖金池">
                <input
                  value={form.rewardPool}
                  onChange={e => updateField("rewardPool", e.target.value)}
                  placeholder="如：完成目标奖励 5 万元"
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>
            </div>
          )}

          {/* ── 行动计划 ── */}
          {activeSection === "plan" && (
            <div className="space-y-4">
              <Field label="行动清单">
                <div className="space-y-2">
                  {form.actions.map((action, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 mt-2 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}>{idx + 1}</span>
                      <input
                        value={action}
                        onChange={e => updateAction(idx, e.target.value)}
                        placeholder={`行动项 ${idx + 1}`}
                        className="flex-1 px-3 py-2 text-sm rounded-sm outline-none"
                        style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                      />
                      <button onClick={() => removeAction(idx)} className="shrink-0 p-2 hover:bg-red-50 rounded-sm transition-colors">
                        <Trash2 size={13} style={{ color: 'oklch(0.55 0.18 22)' }} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addAction}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm transition-colors hover:bg-black/5"
                    style={{ border: '1px dashed oklch(0.75 0.015 75)', color: 'oklch(0.55 0.015 60)' }}
                  >
                    <Plus size={12} /> 添加行动项
                  </button>
                </div>
              </Field>
            </div>
          )}

          {/* ── 进展产出 ── */}
          {activeSection === "progress" && (
            <div className="space-y-4">
              {/* 完成度滑块 */}
              <Field label={`完成度：${form.completionRate}%`}>
                <div className="space-y-2">
                  <input
                    type="range" min={0} max={100} step={5}
                    value={form.completionRate}
                    onChange={e => updateField("completionRate", Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: 'oklch(0.42 0.18 22)' }}
                  />
                  <div className="flex justify-between text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              </Field>

              <Field label="当前成果">
                <textarea
                  value={form.result}
                  onChange={e => updateField("result", e.target.value)}
                  placeholder="描述已取得的成果和进展"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none resize-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>
              <Field label="突破点">
                <textarea
                  value={form.breakthrough}
                  onChange={e => updateField("breakthrough", e.target.value)}
                  placeholder="关键突破或待解决的卡点"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-sm outline-none resize-none"
                  style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                />
              </Field>

              {/* 投入产出 */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="投入工时（人天）">
                  <input
                    type="number" min={0} step={0.5}
                    value={form.inputManDays ?? ""}
                    onChange={e => updateField("inputManDays", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="如：10"
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                  />
                </Field>
                <Field label="产出价值（元）">
                  <input
                    type="number" min={0}
                    value={form.outputValue ?? ""}
                    onChange={e => updateField("outputValue", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="如：100000"
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                  />
                </Field>
              </div>

              {/* 产出附件 */}
              {taskId && (
                <Field label="产出附件">
                  <div className="space-y-2">
                    {/* 已上传附件 */}
                    {attachments && attachments.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {attachments.map(att => (
                          <div key={att.id} className="flex items-center gap-2 p-2 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
                            {att.mimeType?.startsWith("image/") ? (
                              <img src={att.url} alt={att.filename} className="w-10 h-10 object-cover rounded-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 80)' }}>
                                <Image size={16} style={{ color: 'oklch(0.55 0.015 60)' }} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate" style={{ color: 'oklch(0.35 0.015 60)' }}>{att.filename}</p>
                              <p className="text-xs" style={{ color: 'oklch(0.65 0.015 60)' }}>
                                {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)}KB` : ""}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteAttachmentMutation.mutate({ attachmentId: att.id, taskId })}
                              className="shrink-0 p-1 hover:bg-red-50 rounded-sm"
                            >
                              <Trash2 size={11} style={{ color: 'oklch(0.55 0.18 22)' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 上传按钮 */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2.5 w-full justify-center text-sm rounded-sm transition-colors hover:bg-black/5"
                      style={{ border: '1px dashed oklch(0.75 0.015 75)', color: 'oklch(0.55 0.015 60)' }}
                    >
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploading ? "上传中..." : "上传产出附件（图片/文档，最大 10MB）"}
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleFileUpload} />
                  </div>
                </Field>
              )}
              {!taskId && (
                <div className="p-3 rounded-sm text-xs" style={{ background: 'oklch(0.97 0.01 80)', border: '1px solid oklch(0.88 0.012 75)', color: 'oklch(0.55 0.015 60)' }}>
                  💡 保存任务后可上传产出附件
                </div>
              )}
            </div>
          )}

          {/* ── 团队协作 ── */}
          {activeSection === "team" && (
            <div className="space-y-4">
              <Field label="负责人">
                <div className="relative">
                  <input
                    value={form.manager}
                    onChange={e => updateField("manager", e.target.value)}
                    placeholder="输入负责人姓名，或从钉钉通讯录选择"
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none pr-24"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                  />
                  <button
                    onClick={() => setShowDingPicker("manager")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-xs rounded-sm"
                    style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
                  >
                    <Users size={10} /> 钉钉选人
                  </button>
                </div>
              </Field>

              <Field label={`协作成员（${form.contributors.length}人）`}>
                <div className="space-y-2">
                  {form.contributors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.contributors.map(name => (
                        <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ background: 'oklch(0.42 0.18 22 / 0.1)', color: 'oklch(0.42 0.18 22)', border: '1px solid oklch(0.42 0.18 22 / 0.3)' }}>
                          {name}
                          <button onClick={() => toggleMember(name)}><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowDingPicker("member")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm transition-colors hover:bg-black/5"
                    style={{ border: '1px dashed oklch(0.75 0.015 75)', color: 'oklch(0.55 0.015 60)' }}
                  >
                    <Users size={12} /> 从钉钉通讯录选择成员
                  </button>
                </div>
              </Field>

              <Field label={`参与部门（${form.dingDeptIds.length}个）`}>
                <div className="space-y-2">
                  {form.dingDeptIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.dingDeptIds.map(id => {
                        const deptName = deptNameMap[id] || id;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                            style={{ background: 'oklch(0.45 0.15 250 / 0.1)', color: 'oklch(0.45 0.15 250)', border: '1px solid oklch(0.45 0.15 250 / 0.3)' }}>
                            {deptName}
                            <button onClick={() => toggleDept(id)}><X size={10} /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => setShowDingPicker("dept")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm transition-colors hover:bg-black/5"
                    style={{ border: '1px dashed oklch(0.75 0.015 75)', color: 'oklch(0.55 0.015 60)' }}
                  >
                    <Building2 size={12} /> 从钉钉组织架构选择部门
                  </button>
                </div>
              </Field>
            </div>
          )}

          {/* ── 效益核算 ── */}
          {activeSection === "outcome" && (
            <div className="space-y-4">
              {/* 类型说明 */}
              <div className="grid grid-cols-3 gap-2">
                {([["提效", "提升效率", "oklch(0.55 0.18 145)"], ["降本", "节约成本", "oklch(0.45 0.15 250)"], ["增收", "增加收入", "oklch(0.55 0.18 22)"]] as [string, string, string][]).map(([t, desc, color]) => (
                  <button
                    key={t}
                    onClick={() => setOutcomeForm(p => ({ ...p, type: t as any }))}
                    className="p-2.5 rounded-sm text-center transition-all"
                    style={{
                      border: `2px solid ${outcomeForm.type === t ? color : 'oklch(0.88 0.012 75)'}`,
                      background: outcomeForm.type === t ? `${color}15` : 'white',
                    }}
                  >
                    <div className="text-sm font-bold" style={{ color: outcomeForm.type === t ? color : 'oklch(0.45 0.015 60)' }}>{t}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'oklch(0.6 0.015 60)' }}>{desc}</div>
                  </button>
                ))}
              </div>

              {/* 输入表单 */}
              <div className="p-4 rounded-sm space-y-3" style={{ background: 'oklch(0.97 0.01 80)', border: '1px solid oklch(0.88 0.012 75)' }}>
                <Field label="场景描述">
                  <input
                    value={outcomeForm.scenario}
                    onChange={e => setOutcomeForm(p => ({ ...p, scenario: e.target.value }))}
                    placeholder={`例：${outcomeForm.type === '提效' ? '每次审计报告需要多少小时' : outcomeForm.type === '降本' ? '每月人工审核费用' : '每月销售额'}`}
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`AI介入前（${outcomeForm.unit.split('/')[0]}）`}>
                    <input
                      type="number"
                      value={outcomeForm.beforeValue}
                      onChange={e => setOutcomeForm(p => ({ ...p, beforeValue: e.target.value }))}
                      placeholder="介入前数值"
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                      style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                    />
                  </Field>
                  <Field label={`AI介入后（${outcomeForm.unit.split('/')[0]}）`}>
                    <input
                      type="number"
                      value={outcomeForm.afterValue}
                      onChange={e => setOutcomeForm(p => ({ ...p, afterValue: e.target.value }))}
                      placeholder="介入后数值"
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                      style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="单位">
                    <select
                      value={outcomeForm.unit}
                      onChange={e => setOutcomeForm(p => ({ ...p, unit: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                      style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                    >
                      {OUTCOME_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </Field>
                  <Field label="每月频次">
                    <input
                      type="number"
                      value={outcomeForm.frequency}
                      onChange={e => setOutcomeForm(p => ({ ...p, frequency: e.target.value }))}
                      placeholder="每月次数"
                      className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                      style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                    />
                  </Field>
                </div>
                <Field label="备注（可空）">
                  <input
                    value={outcomeForm.remark}
                    onChange={e => setOutcomeForm(p => ({ ...p, remark: e.target.value }))}
                    placeholder="补充说明"
                    className="w-full px-3 py-2 text-sm rounded-sm outline-none"
                    style={{ border: '1px solid oklch(0.84 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                  />
                </Field>

                {/* 实时预览效益结论 */}
                {outcomeForm.beforeValue && outcomeForm.afterValue && (() => {
                  const bv = parseFloat(outcomeForm.beforeValue);
                  const av = parseFloat(outcomeForm.afterValue);
                  const freq = parseFloat(outcomeForm.frequency) || 1;
                  if (isNaN(bv) || isNaN(av) || bv === 0) return null;
                  const diff = outcomeForm.type === '增收' ? (av - bv) * freq : (bv - av) * freq;
                  const pct = ((diff / (bv * freq)) * 100).toFixed(1);
                  const isPositive = diff > 0;
                  const typeColor = outcomeForm.type === '提效' ? 'oklch(0.55 0.18 145)' : outcomeForm.type === '降本' ? 'oklch(0.45 0.15 250)' : 'oklch(0.55 0.18 22)';
                  return (
                    <div className="p-3 rounded-sm" style={{ background: isPositive ? `${typeColor}12` : 'oklch(0.97 0.01 22 / 0.3)', border: `1px solid ${isPositive ? typeColor : 'oklch(0.75 0.1 22)'}40` }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: isPositive ? typeColor : 'oklch(0.55 0.18 22)' }}>
                        {isPositive ? '✅' : '⚠️'} 效益预览
                      </div>
                      <div className="text-sm" style={{ color: 'oklch(0.22 0.015 60)' }}>
                        {outcomeForm.type === '提效' && `每月提效 ${Math.abs(diff).toFixed(1)} ${outcomeForm.unit.split('/')[0]}，提升 ${Math.abs(parseFloat(pct))}%`}
                        {outcomeForm.type === '降本' && `每月节约 ${Math.abs(diff).toFixed(1)} ${outcomeForm.unit.split('/')[0]}，降低 ${Math.abs(parseFloat(pct))}%`}
                        {outcomeForm.type === '增收' && `每月增加 ${Math.abs(diff).toFixed(1)} ${outcomeForm.unit.split('/')[0]}，增长 ${Math.abs(parseFloat(pct))}%`}
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={handleAddOutcome}
                  disabled={outcomeSubmitting || !taskId}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-sm font-medium transition-all w-full justify-center"
                  style={{ background: outcomeSubmitting ? 'oklch(0.75 0.015 60)' : 'oklch(0.42 0.18 22)', color: 'white' }}
                >
                  {outcomeSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {!taskId ? '请先保存任务' : '添加效益记录'}
                </button>
              </div>

              {/* 历史记录 */}
              {outcomeList && outcomeList.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold" style={{ color: 'oklch(0.45 0.015 60)' }}>已记录效益（{outcomeList.length}条）</h4>
                  {outcomeList.map((o: any) => {
                    const typeColor = o.type === '提效' ? 'oklch(0.55 0.18 145)' : o.type === '降本' ? 'oklch(0.45 0.15 250)' : 'oklch(0.55 0.18 22)';
                    return (
                      <div key={o.id} className="flex items-start gap-3 p-3 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-sm font-medium" style={{ background: `${typeColor}15`, color: typeColor }}>{o.type}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: 'oklch(0.22 0.015 60)' }}>{o.scenario}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.015 60)' }}>
                            {o.beforeValue} → {o.afterValue} {o.unit}，
                            <span style={{ color: o.diff > 0 ? typeColor : 'oklch(0.55 0.18 22)' }}>
                              {o.diff > 0 ? '+' : ''}{o.diff} ({o.diffPct > 0 ? '+' : ''}{o.diffPct}%)
                            </span>
                            {o.frequency > 1 && ` ×${o.frequency}次/月`}
                          </p>
                          {o.remark && <p className="text-xs mt-0.5" style={{ color: 'oklch(0.65 0.015 60)' }}>{o.remark}</p>}
                        </div>
                        <button
                          onClick={() => deleteOutcomeMutation.mutate({ id: o.id })}
                          className="shrink-0 p-1 hover:bg-red-50 rounded-sm"
                        >
                          <Trash2 size={11} style={{ color: 'oklch(0.55 0.18 22)' }} />
                        </button>
                      </div>
                    );
                  })}
                  {/* 汇总 */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['提效', '降本', '增收'].map(t => {
                      const items = (outcomeList as any[]).filter(o => o.type === t);
                      if (items.length === 0) return null;
                      const total = items.reduce((s: number, o: any) => s + (o.diff * o.frequency), 0);
                      const color = t === '提效' ? 'oklch(0.55 0.18 145)' : t === '降本' ? 'oklch(0.45 0.15 250)' : 'oklch(0.55 0.18 22)';
                      return (
                        <div key={t} className="p-2 rounded-sm text-center" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
                          <div className="text-[10px]" style={{ color: 'oklch(0.55 0.015 60)' }}>{t}汇总</div>
                          <div className="text-sm font-bold" style={{ color }}>{total.toFixed(1)}</div>
                          <div className="text-[10px]" style={{ color: 'oklch(0.65 0.015 60)' }}>{items[0].unit.split('/')[0]}/月</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 积分核算 ── */}
          {activeSection === "score" && (
            <div className="space-y-4">
              {taskId ? (
                <>
                  <div className="p-4 rounded-sm" style={{ background: 'oklch(0.97 0.01 80)', border: '1px solid oklch(0.88 0.012 75)' }}>
                    <p className="text-xs mb-3" style={{ color: 'oklch(0.55 0.015 60)' }}>
                      AI 将根据任务完成度、产出质量、时效性、协作情况四个维度综合评分，并核算预估奖金。
                    </p>
                    {/* 辅导员配置 */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: 'oklch(0.45 0.015 60)' }}>辅导员参与等级</label>
                        <select
                          value={mentorLevel}
                          onChange={e => setMentorLevel(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 rounded-sm border"
                          style={{ borderColor: 'oklch(0.86 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                        >
                          <option value="未参与">未参与</option>
                          <option value="指导成功">指导成功</option>
                          <option value="主动辅导">主动辅导</option>
                          <option value="与成功案例">与成功案例</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block" style={{ color: 'oklch(0.45 0.015 60)' }}>辅导员姓名</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={mentorName}
                            onChange={e => setMentorName(e.target.value)}
                            placeholder="辅导员姓名（可空）"
                            className="w-full text-xs px-2 py-1.5 rounded-sm border pr-16"
                            style={{ borderColor: 'oklch(0.86 0.012 75)', background: 'white', color: 'oklch(0.22 0.015 60)' }}
                          />
                          <button
                            onClick={() => setShowDingPicker("mentor" as any)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-sm"
                            style={{ background: 'oklch(0.42 0.18 22)', color: 'white' }}
                          >
                            <Users size={9} /> 选人
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setScoring(true); scoreMutation.mutate({ taskId, mentorLevel, mentorName }); }}
                      disabled={scoring}
                      className="flex items-center gap-2 px-4 py-2 text-sm rounded-sm font-medium transition-all"
                      style={{ background: scoring ? 'oklch(0.75 0.015 60)' : 'oklch(0.42 0.18 22)', color: 'white' }}
                    >
                      {scoring ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {scoring ? "AI 核算中..." : "立即 AI 核算积分"}
                    </button>
                  </div>

                  {displayScore && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold" style={{ color: 'oklch(0.22 0.015 60)' }}>核算结果</h4>

                      {/* 图五积分标准基础积分 */}
                      {(displayScore.projectValueLevel || displayScore.gateName) && (
                        <div className="p-3 rounded-sm" style={{ background: 'oklch(0.35 0.12 200 / 0.08)', border: '1px solid oklch(0.35 0.12 200 / 0.25)' }}>
                          <div className="text-xs font-semibold mb-2" style={{ color: 'oklch(0.35 0.12 200)' }}>图五积分标准</div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-sm" style={{ background: 'white', border: '1px solid oklch(0.88 0.012 75)' }}>
                              <div className="text-[10px] text-muted-foreground">项目价值等级</div>
                              <div className="text-sm font-bold" style={{ color: 'oklch(0.42 0.18 22)' }}>{displayScore.projectValueLevel || '-'}级</div>
                            </div>
                            <div className="p-2 rounded-sm" style={{ background: 'white', border: '1px solid oklch(0.88 0.012 75)' }}>
                              <div className="text-[10px] text-muted-foreground">当前门位</div>
                              <div className="text-sm font-bold" style={{ color: 'oklch(0.45 0.15 250)' }}>{displayScore.gateName || '-'}</div>
                            </div>
                            <div className="p-2 rounded-sm" style={{ background: 'white', border: '1px solid oklch(0.88 0.012 75)' }}>
                              <div className="text-[10px] text-muted-foreground">里程碑积分</div>
                              <div className="text-sm font-bold" style={{ color: 'oklch(0.55 0.18 145)' }}>{displayScore.milestoneScore ?? '-'}分</div>
                            </div>
                            <div className="p-2 rounded-sm" style={{ background: 'white', border: '1px solid oklch(0.88 0.012 75)' }}>
                              <div className="text-[10px] text-muted-foreground">月度预期</div>
                              <div className="text-sm font-bold" style={{ color: 'oklch(0.55 0.18 60)' }}>{displayScore.monthlyScore ?? '-'}分/月</div>
                            </div>
                            {displayScore.mentorScore !== undefined && displayScore.mentorScore > 0 && (
                              <div className="p-2 rounded-sm col-span-2" style={{ background: 'white', border: '1px solid oklch(0.88 0.012 75)' }}>
                                <div className="text-[10px] text-muted-foreground">辅导员积分{displayScore.mentorName ? `（${displayScore.mentorName}）` : ''}</div>
                                <div className="text-sm font-bold" style={{ color: 'oklch(0.55 0.18 300)' }}>+{displayScore.mentorScore}分</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AI 质量维度得分 */}
                      <div className="grid grid-cols-2 gap-3">
                        <ScoreCard label="完成度积分" value={displayScore.completionScore} max={100} color="oklch(0.55 0.18 145)" />
                        <ScoreCard label="产出质量积分" value={displayScore.qualityScore} max={100} color="oklch(0.45 0.15 250)" />
                        <ScoreCard label="时效积分" value={displayScore.timelinessScore} max={100} color="oklch(0.55 0.18 60)" />
                        <ScoreCard label="协作积分" value={displayScore.collaborationScore} max={100} color="oklch(0.55 0.18 300)" />
                      </div>
                      <div className="p-4 rounded-sm" style={{ background: 'oklch(0.42 0.18 22 / 0.08)', border: '1px solid oklch(0.42 0.18 22 / 0.2)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold" style={{ color: 'oklch(0.22 0.015 60)' }}>综合积分</span>
                          <span className="text-2xl font-bold" style={{ color: 'oklch(0.42 0.18 22)', fontFamily: "'Noto Serif SC', serif" }}>
                            {displayScore.totalScore?.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs" style={{ color: 'oklch(0.55 0.015 60)' }}>预估奖金</span>
                          <span className="text-sm font-semibold" style={{ color: 'oklch(0.42 0.18 22)' }}>
                            ¥{displayScore.estimatedBonus?.toLocaleString()}
                          </span>
                        </div>
                        {displayScore.roi && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs" style={{ color: 'oklch(0.55 0.015 60)' }}>投入产出比</span>
                            <span className="text-sm font-semibold" style={{ color: 'oklch(0.45 0.15 250)' }}>
                              {displayScore.roi.toFixed(2)}x
                            </span>
                          </div>
                        )}
                      </div>
                      {displayScore.aiSummary && (
                        <div className="p-3 rounded-sm text-xs" style={{ background: 'oklch(0.97 0.01 80)', border: '1px solid oklch(0.88 0.012 75)', color: 'oklch(0.45 0.015 60)' }}>
                          <span className="font-medium" style={{ color: 'oklch(0.35 0.015 60)' }}>AI 分析：</span>
                          {displayScore.aiSummary}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-sm text-sm text-center" style={{ background: 'oklch(0.97 0.01 80)', border: '1px solid oklch(0.88 0.012 75)', color: 'oklch(0.55 0.015 60)' }}>
                  💡 保存任务后可进行 AI 积分核算
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0" style={{ borderTop: '1px solid oklch(0.88 0.012 75)', background: 'oklch(0.965 0.01 80)' }}>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-sm transition-colors hover:bg-black/5" style={{ color: 'oklch(0.45 0.015 60)' }}>
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 text-sm rounded-sm font-medium transition-all"
            style={{ background: isPending ? 'oklch(0.75 0.015 60)' : 'oklch(0.42 0.18 22)', color: 'white' }}
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? "保存修改" : "创建任务"}
          </button>
        </div>
      </div>

      {/* 钉钉通讯录选人弹窗 */}
      {showDingPicker && (
        <DingContactsPicker
          mode={showDingPicker === "dept" ? "dept" : "member"}
          singleSelect={showDingPicker === "manager" || showDingPicker === "mentor"}
          selectedUserIds={form.contributors.map(() => "")}
          selectedDeptIds={form.dingDeptIds.map(id => parseInt(id) || 0).filter(Boolean)}
          onConfirm={handleDingConfirm}
          onClose={() => setShowDingPicker(null)}
        />
      )}
    </div>
  );
}

// ─── 子组件 ───────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: 'oklch(0.45 0.015 60)' }}>{label}</label>
      {children}
    </div>
  );
}

function ScoreCard({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="p-3 rounded-sm" style={{ border: '1px solid oklch(0.88 0.012 75)', background: 'white' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'oklch(0.55 0.015 60)' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{value?.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'oklch(0.92 0.01 80)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
