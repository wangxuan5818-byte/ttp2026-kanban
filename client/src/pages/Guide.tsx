/*
 * TTP2026 AI战略看板 - 填写说明书 & 看板介绍
 * 纸质战情室风格
 */

import { useState } from "react";
import { X, ChevronRight, BookOpen, Layout, Users, Star, Shield, Zap } from "lucide-react";

interface GuideProps {
  onClose: () => void;
  isAdmin?: boolean;
}

type TabId = "intro" | "fields" | "accounts" | "scoring" | "roi" | "workflow";

export default function Guide({ onClose, isAdmin = false }: GuideProps) {
  const [activeTab, setActiveTab] = useState<TabId>("intro");

  // 管理员可见全部标签，部门成员隐藏账号权限页
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "intro", label: "系统介绍", icon: <Layout size={14} /> },
    { id: "fields", label: "字段说明", icon: <BookOpen size={14} /> },
    ...(isAdmin ? [{ id: "accounts" as TabId, label: "账号权限", icon: <Shield size={14} /> }] : []),
    { id: "scoring", label: "积分规则", icon: <Star size={14} /> },
    { id: "roi", label: "效益核算", icon: <Zap size={14} /> },
    { id: "workflow", label: "操作流程", icon: <Users size={14} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'oklch(0.08 0.01 60 / 0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-sm shadow-2xl flex flex-col overflow-hidden"
        style={{ background: 'oklch(0.97 0.006 80)', border: '1px solid oklch(0.86 0.012 75)' }}
      >
        {/* 顶部标题栏 */}
        <div
          className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border"
          style={{ background: 'oklch(0.42 0.18 22)', color: 'oklch(0.98 0.002 60)' }}
        >
          <div className="flex items-center gap-3">
            <BookOpen size={18} />
            <div>
              <h2 className="text-base font-bold tracking-wide" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                TTP2026 AI战略会 · 使用说明书
              </h2>
              <p className="text-xs opacity-70 mt-0.5">三体人突围战 · 目标600万 · 各部门协同作战</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 标签栏 */}
        <div className="shrink-0 flex border-b border-border px-4 pt-3 gap-1" style={{ background: 'oklch(0.99 0.004 80)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-sm transition-all duration-200 border-b-2"
              style={{
                borderBottomColor: activeTab === tab.id ? 'oklch(0.42 0.18 22)' : 'transparent',
                color: activeTab === tab.id ? 'oklch(0.42 0.18 22)' : 'oklch(0.52 0.02 60)',
                background: activeTab === tab.id ? 'oklch(0.42 0.18 22 / 0.06)' : 'transparent',
                fontWeight: activeTab === tab.id ? '600' : '400',
              }}
            >
              {tab.icon}
              <span style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "intro" && <IntroTab />}
          {activeTab === "fields" && <FieldsTab />}
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "scoring" && <ScoringTab />}
          {activeTab === "roi" && <RoiTab />}
          {activeTab === "workflow" && <WorkflowTab />}
        </div>
      </div>
    </div>
  );
}

// ─── 系统介绍 ───────────────────────────────────────────────
function IntroTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="系统概述" accent="oklch(0.42 0.18 22)">
        <p className="text-sm text-foreground leading-relaxed">
          <strong>TTP2026 AI战略看板</strong>是三体人突围战的核心指挥系统，服务于集团各部门的战略任务跟踪与协同管理。
          系统以「纸质战情室」为视觉风格，将年度600万目标拆解为可执行的任务路径，通过闭环完成度自动核算项目积分与奖金。
        </p>
      </Section>

      <Section title="核心战略目标" accent="oklch(0.42 0.18 22)">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "路径一", desc: "四大业务域三体人预售", icon: "🎯" },
            { label: "路径二", desc: "装修行业CAD三体人预售", icon: "🏗️" },
            { label: "路径三", desc: "构建四大业务域三体人整体解决方案", icon: "🌐" },
          ].map((p, i) => (
            <div key={i} className="p-3 rounded-sm" style={{ background: 'oklch(0.42 0.18 22 / 0.06)', border: '1px solid oklch(0.42 0.18 22 / 0.2)' }}>
              <div className="text-lg mb-1">{p.icon}</div>
              <div className="text-xs font-semibold text-foreground mb-1" style={{ fontFamily: "'Noto Serif SC', serif" }}>{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="各部门职能" accent="oklch(0.78 0.12 75)">
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: "⚔️ 前线委员会", desc: "销售突击队建设、业绩增量突破、人效提升" },
            { name: "🚀 火箭军", desc: "AI工厂智能体打造、工厂自动化、三体人预售" },
            { name: "🔬 研发委员会", desc: "三体人产品研发、AI技术突破、平台开放" },
            { name: "🏙️ 政治局", desc: "战略决策、资源调配、跨部门协同" },
            { name: "🛡️ 神盾局", desc: "品牌建设、市场防御、竞争情报" },
            { name: "💰 资管委", desc: "资金管理、投融资、财务健康" },
            { name: "🔍 检委会", desc: "质量监督、合规审查、风险管控" },
            { name: "🌊 海委会", desc: "海外市场拓展、国际化战略" },
            { name: "💼 参谋部", desc: "战略规划、情报分析、作战方案制定" },
            { name: "🌿 政治部", desc: "组织建设、思想建设、文化建设" },
          ].map((c, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-sm" style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.90 0.008 75)' }}>
              <div className="flex-1">
                <div className="text-xs font-semibold text-foreground">{c.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="系统功能模块" accent="oklch(0.35 0.12 200)">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "📋", title: "战略总览", desc: "全局任务状态、卡点预警、月度里程碑一览" },
            { icon: "📌", title: "委员会看板", desc: "任务卡片管理、里程碑时间轴、成员责任规划" },
            { icon: "📝", title: "任务详情", desc: "目标、策略、行动清单、产出附件、进展记录" },
            { icon: "🤖", title: "AI核算引擎", desc: "投入产出比分析、积分自动核算、奖金计算" },
            { icon: "📊", title: "积分排行", desc: "委员会积分排名、个人贡献度、奖金分配" },
            { icon: "🔗", title: "钉钉集成", desc: "组织架构同步、成员通讯录、部门选择" },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-sm" style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.90 0.008 75)' }}>
              <span className="text-xl shrink-0">{f.icon}</span>
              <div>
                <div className="text-xs font-semibold text-foreground">{f.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── 字段说明 ───────────────────────────────────────────────
function FieldsTab() {
  const fields = [
    { field: "任务名称", required: true, type: "文本", desc: "简洁描述任务核心目标，建议10字以内，如「老板良三三制销售突破」" },
    { field: "任务目标", required: true, type: "长文本", desc: "具体可量化的目标描述，包含数字指标，如「月度业绩从15600增长至52049元」" },
    { field: "执行策略", required: true, type: "长文本", desc: "达成目标的核心方法论，说明「如何做」，如「三三制工作模式：线索组→方案组→交付组」" },
    { field: "行动清单", required: true, type: "列表", desc: "具体可执行的行动项，每项为独立动作，建议3-7条，如「每天发各平台告知视频/海报/销售话术」" },
    { field: "关键里程碑", required: true, type: "文本", desc: "阶段性成果节点，包含时间和量化指标，如「月度业绩15600→52049元，三三制队伍12人成型」" },
    { field: "当前进展", required: false, type: "长文本", desc: "最新实际完成情况，定期更新，如「电话量993，有效电话453（45%），线索142」" },
    { field: "需突破能力", required: false, type: "长文本", desc: "完成任务需要攻克的核心难点，如「高价值线索识别，三三制协同能力（线索共享）」" },
    { field: "负责人", required: true, type: "人员选择", desc: "任务主责任人，只能选择一人，可从钉钉通讯录选取" },
    { field: "协作成员", required: false, type: "人员选择（多选）", desc: "参与任务的协作人员，可多选，支持跨委员会选人" },
    { field: "截止日期", required: true, type: "日期", desc: "任务完成的最终期限，格式：YYYY-MM-DD" },
    { field: "任务状态", required: true, type: "枚举", desc: "进行中 / 待启动 / 已完成 / 有卡点，有卡点时需填写突破点" },
    { field: "产出附件", required: false, type: "文件/图片", desc: "任务成果的证明材料，支持图片、文档上传，最大单文件10MB" },
    { field: "奖金机制", required: false, type: "文本", desc: "该任务对应的奖金规则，如「PK奖励 + 奖金池」" },
    { field: "投入工时", required: false, type: "数字", desc: "预计/实际投入人天数，用于AI核算投入产出比" },
    { field: "产出价值", required: false, type: "数字（元）", desc: "任务产生的可量化业务价值，用于AI核算投入产出比" },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-sm text-muted-foreground mb-4">
        以下为任务填写时各字段的说明，<span className="text-red-600 font-medium">红色星号</span>表示必填字段。
      </div>
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'oklch(0.14 0.012 60)', color: 'oklch(0.88 0.008 75)' }}>
              <th className="text-left px-4 py-2.5 font-semibold w-28">字段名称</th>
              <th className="text-left px-4 py-2.5 font-semibold w-8">必填</th>
              <th className="text-left px-4 py-2.5 font-semibold w-28">类型</th>
              <th className="text-left px-4 py-2.5 font-semibold">填写说明</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr
                key={i}
                className="border-t border-border"
                style={{ background: i % 2 === 0 ? 'oklch(0.99 0.003 80)' : 'oklch(0.97 0.004 80)' }}
              >
                <td className="px-4 py-2.5 font-medium text-foreground">{f.field}</td>
                <td className="px-4 py-2.5 text-center">
                  {f.required ? <span className="text-red-600 font-bold">★</span> : <span className="text-muted-foreground">-</span>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{f.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground leading-relaxed">{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-sm text-xs" style={{ background: 'oklch(0.97 0.04 75)', border: '1px solid oklch(0.82 0.10 75)' }}>
        <div className="font-semibold mb-2" style={{ color: 'oklch(0.45 0.12 75)' }}>💡 填写建议</div>
        <ul className="space-y-1 text-muted-foreground">
          <li><ChevronRight size={10} className="inline mr-1" />任务目标和里程碑必须包含可量化的数字指标，便于AI核算进度</li>
          <li><ChevronRight size={10} className="inline mr-1" />行动清单建议每周更新，已完成的行动项请及时标记</li>
          <li><ChevronRight size={10} className="inline mr-1" />产出附件是积分核算的重要依据，请及时上传成果截图、报告等</li>
          <li><ChevronRight size={10} className="inline mr-1" />有卡点状态的任务需在「需突破能力」字段详细说明阻碍原因</li>
        </ul>
      </div>
    </div>
  );
}

// ─── 账号权限 ───────────────────────────────────────────────
function AccountsTab() {
  const accounts = [
    { username: "admin", role: "总管理员", scope: "全部委员会", canEdit: "所有任务", defaultPwd: "ttp2026admin" },
    { username: "qianwei", role: "前委", scope: "集团前线委员会", canEdit: "本委员会任务", defaultPwd: "ttp2026@qianwei" },
    { username: "huojunjun", role: "火箭军", scope: "火箭军委员会", canEdit: "本委员会任务", defaultPwd: "ttp2026@huojunjun" },
    { username: "yanwei", role: "研委会", scope: "研发委员会", canEdit: "本委员会任务", defaultPwd: "ttp2026@yanwei" },
    { username: "zhengjiju", role: "政治局", scope: "政治局", canEdit: "本委员会任务", defaultPwd: "ttp2026@zhengjiju" },
    { username: "shendunjv", role: "神盾局", scope: "神盾局", canEdit: "本委员会任务", defaultPwd: "ttp2026@shendunjv" },
    { username: "ziguanwei", role: "资管委", scope: "资产管理委员会", canEdit: "本委员会任务", defaultPwd: "ttp2026@ziguanwei" },
    { username: "jianwei", role: "检委会", scope: "检查委员会", canEdit: "本委员会任务", defaultPwd: "ttp2026@jianwei" },
    { username: "haiwei", role: "海委会", scope: "海外委员会", canEdit: "本委员会任务", defaultPwd: "ttp2026@haiwei" },
    { username: "zuzhihu", role: "组织部", scope: "组织部", canEdit: "本委员会任务", defaultPwd: "ttp2026@zuzhihu" },
    { username: "caiwubu", role: "财务部", scope: "财务部", canEdit: "本委员会任务", defaultPwd: "ttp2026@caiwubu" },
    { username: "dangzuzhi", role: "党组织", scope: "党组织", canEdit: "本部门任务", defaultPwd: "ttp2026@dangzuzhi" },
    { username: "canzhoubu", role: "参谋部", scope: "参谋部", canEdit: "本部门任务", defaultPwd: "ttp2026@canzhoubu" },
    { username: "zhengzhibu", role: "政治部", scope: "政治部", canEdit: "本部门任务", defaultPwd: "ttp2026@zhengzhibu" },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <Section title="权限体系说明" accent="oklch(0.42 0.18 22)">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-sm" style={{ background: 'oklch(0.42 0.18 22 / 0.06)', border: '1px solid oklch(0.42 0.18 22 / 0.25)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} style={{ color: 'oklch(0.42 0.18 22)' }} />
              <span className="text-sm font-bold" style={{ color: 'oklch(0.42 0.18 22)', fontFamily: "'Noto Serif SC', serif" }}>总管理员</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✅ 查看所有委员会数据</li>
              <li>✅ 战略总览仪表盘</li>
              <li>✅ 增删改所有任务</li>
              <li>✅ 管理账号和权限</li>
              <li>✅ 查看积分排行榜</li>
              <li>✅ 导出数据报告</li>
            </ul>
          </div>
          <div className="p-4 rounded-sm" style={{ background: 'oklch(0.35 0.12 200 / 0.06)', border: '1px solid oklch(0.35 0.12 200 / 0.25)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} style={{ color: 'oklch(0.35 0.12 200)' }} />
              <span className="text-sm font-bold" style={{ color: 'oklch(0.35 0.12 200)', fontFamily: "'Noto Serif SC', serif" }}>部门成员</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✅ 查看本部门数据</li>
              <li>✅ 增删改本部门任务</li>
              <li>✅ 上传产出附件</li>
              <li>✅ 查看本部门积分</li>
              <li>❌ 无法查看其他部门</li>
              <li>❌ 无法管理账号</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="账号列表" accent="oklch(0.78 0.12 75)">
        <div className="text-xs text-muted-foreground mb-3 p-3 rounded-sm" style={{ background: 'oklch(0.97 0.04 22)', border: '1px solid oklch(0.80 0.12 22)' }}>
          ⚠️ 以下为各部门初始账号及默认密码，首次登录后请及时修改密码。账号由总管理员统一分配。
        </div>
        <div className="overflow-hidden rounded-sm border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'oklch(0.14 0.012 60)', color: 'oklch(0.88 0.008 75)' }}>
                <th className="text-left px-3 py-2 font-semibold">用户名</th>
                <th className="text-left px-3 py-2 font-semibold">默认密码</th>
                <th className="text-left px-3 py-2 font-semibold">角色</th>
                <th className="text-left px-3 py-2 font-semibold">可见范围</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={i} className="border-t border-border" style={{ background: i % 2 === 0 ? 'oklch(0.99 0.003 80)' : 'oklch(0.97 0.004 80)' }}>
                  <td className="px-3 py-2 font-mono font-medium text-foreground">{a.username}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{a.defaultPwd}</td>
                  <td className="px-3 py-2">
                    <span
                      className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium"
                      style={{
                        background: i === 0 ? 'oklch(0.42 0.18 22)' : 'oklch(0.35 0.12 200)',
                        color: 'oklch(0.98 0.002 60)',
                      }}
                    >
                      {i === 0 ? "管理员" : "部门"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ─── 积分规则 ───────────────────────────────────────────────
function ScoringTab() {
  return (
    <div className="space-y-5 max-w-3xl">
      <Section title="积分核算体系" accent="oklch(0.78 0.12 75)">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          系统通过 AI 核算引擎，根据任务的闭环完成度自动计算项目积分和奖金分配。积分由四个维度综合评定：
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "完成度积分", weight: "40%", desc: "基于任务状态（已完成=100分，进行中=50分，有卡点=20分，待启动=0分）", color: "oklch(0.35 0.15 145)" },
            { label: "产出质量积分", weight: "30%", desc: "基于产出附件数量、里程碑达成率、可量化指标完成情况", color: "oklch(0.35 0.12 200)" },
            { label: "时效积分", weight: "20%", desc: "在截止日期前完成得满分，超期按天数递减，提前完成有加分", color: "oklch(0.78 0.12 75)" },
            { label: "协作积分", weight: "10%", desc: "跨委员会协作任务额外加分，贡献成员均可获得协作积分", color: "oklch(0.42 0.18 22)" },
          ].map((d, i) => (
            <div key={i} className="p-3 rounded-sm" style={{ background: `${d.color}08`, border: `1px solid ${d.color}30` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">{d.label}</span>
                <span className="text-xs font-mono font-bold" style={{ color: d.color }}>{d.weight}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="奖金核算规则" accent="oklch(0.42 0.18 22)">
        <div className="space-y-3">
          <div className="p-3 rounded-sm text-xs" style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.86 0.012 75)' }}>
            <div className="font-semibold text-foreground mb-2">奖金池构成</div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>• 增量产出净利润 <strong>3%</strong> 进入部门奖金池</div>
              <div>• 战区分仓/分局利润 <strong>0.6%</strong> 进入部门奖金池</div>
              <div>• 个人奖金 = 部门奖金池 × 个人积分占比</div>
              <div>• 跨部门协作任务按贡献度分配</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'oklch(0.14 0.012 60)', color: 'oklch(0.88 0.008 75)' }}>
                  <th className="text-left px-3 py-2">完成度区间</th>
                  <th className="text-left px-3 py-2">奖金系数</th>
                  <th className="text-left px-3 py-2">说明</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { range: "90% ~ 100%", coeff: "1.2x", note: "超额完成，额外奖励20%" },
                  { range: "70% ~ 89%", coeff: "1.0x", note: "正常完成，全额奖金" },
                  { range: "50% ~ 69%", coeff: "0.7x", note: "部分完成，奖金打七折" },
                  { range: "30% ~ 49%", coeff: "0.4x", note: "完成度不足，奖金打四折" },
                  { range: "0% ~ 29%", coeff: "0x", note: "未达标，不计入奖金" },
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border" style={{ background: i % 2 === 0 ? 'oklch(0.99 0.003 80)' : 'oklch(0.97 0.004 80)' }}>
                    <td className="px-3 py-2 font-mono text-foreground">{r.range}</td>
                    <td className="px-3 py-2 font-mono font-bold" style={{ color: i === 0 ? 'oklch(0.35 0.15 145)' : i >= 3 ? 'oklch(0.42 0.18 22)' : 'oklch(0.35 0.02 60)' }}>{r.coeff}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="AI 投入产出比核算" accent="oklch(0.35 0.12 200)">
        <p className="text-sm text-muted-foreground leading-relaxed">
          AI核算引擎会综合分析每个任务的投入工时、产出价值、完成质量，自动生成 ROI 报告。
          ROI = 产出价值 ÷ 投入成本（人力成本 + 资源成本），高ROI任务在积分排行中获得额外权重。
        </p>
      </Section>
    </div>
  );
}

// ─── 效益核算 ───────────────────────────────────────────────
function RoiTab() {
  return (
    <div className="space-y-5 max-w-3xl">
      <Section title="效益核算模块概述" accent="oklch(0.35 0.12 200)">
        <p className="text-sm text-muted-foreground leading-relaxed">
          效益核算模块通过 AI 引擎对每个任务的<strong>投入成本与产出价值</strong>进行量化分析，自动生成 ROI 报告，
          帮助各部门评估各项 AI 战略任务的实际经济效益，指导资源优化配置。
        </p>
      </Section>

      <Section title="投入指标填写说明" accent="oklch(0.42 0.18 22)">
        <div className="space-y-2">
          {[
            { field: "投入工时（人天）", desc: "完成该任务实际投入的人力天数，1人天 = 8小时工作量。多人协作时填写所有人的工时总和。", example: "如3人参与，各投入5天，填写15人天" },
            { field: "产出价值（元）", desc: "任务直接产生的可量化业务价值，包括：新增销售额、节省成本、提升效率折算价值等。", example: "如新增销售额10万元，填写100000" },
            { field: "奖金机制", desc: "该任务对应的激励规则，如 PK 奖励、项目奖金池分配比例等，影响奖金核算结果。", example: "如：增量净利润3%进入奖金池" },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-sm" style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.90 0.008 75)' }}>
              <div className="text-xs font-semibold text-foreground mb-1">{item.field}</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed mb-1">{item.desc}</div>
              <div className="text-[10px] px-2 py-1 rounded-sm" style={{ background: 'oklch(0.94 0.008 75)', color: 'oklch(0.45 0.06 75)' }}>示例：{item.example}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ROI 计算公式" accent="oklch(0.78 0.12 75)">
        <div className="p-4 rounded-sm mb-3 text-center" style={{ background: 'oklch(0.14 0.012 60)', color: 'oklch(0.88 0.008 75)' }}>
          <div className="text-sm font-mono font-bold mb-2">ROI = 产出价值 ÷ 投入成本 × 100%</div>
          <div className="text-[11px] opacity-70">投入成本 = 投入工时 × 人力日费率（默认800元/人天）+ 资源费用</div>
        </div>
        <div className="overflow-hidden rounded-sm border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'oklch(0.14 0.012 60)', color: 'oklch(0.88 0.008 75)' }}>
                <th className="text-left px-3 py-2">ROI 区间</th>
                <th className="text-left px-3 py-2">效益评级</th>
                <th className="text-left px-3 py-2">积分权重</th>
                <th className="text-left px-3 py-2">说明</th>
              </tr>
            </thead>
            <tbody>
              {[
                { range: "≥ 500%", grade: "S级·卓越", weight: "2.0x", note: "产出超出投入5倍以上，优先扩大投入", color: "oklch(0.35 0.15 145)" },
                { range: "200% ~ 499%", grade: "A级·优秀", weight: "1.5x", note: "产出超出投入2-5倍，保持推进", color: "oklch(0.35 0.12 200)" },
                { range: "100% ~ 199%", grade: "B级·良好", weight: "1.2x", note: "产出高于投入，正向收益", color: "oklch(0.78 0.12 75)" },
                { range: "50% ~ 99%", grade: "C级·达标", weight: "1.0x", note: "基本覆盖投入，需优化", color: "oklch(0.55 0.18 60)" },
                { range: "＜ 50%", grade: "D级·待改善", weight: "0.5x", note: "产出低于投入，需评估是否继续", color: "oklch(0.42 0.18 22)" },
              ].map((r, i) => (
                <tr key={i} className="border-t border-border" style={{ background: i % 2 === 0 ? 'oklch(0.99 0.003 80)' : 'oklch(0.97 0.004 80)' }}>
                  <td className="px-3 py-2 font-mono font-bold" style={{ color: r.color }}>{r.range}</td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium" style={{ background: `${r.color}15`, color: r.color }}>{r.grade}</span></td>
                  <td className="px-3 py-2 font-mono font-bold" style={{ color: r.color }}>{r.weight}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="效益核算操作步骤" accent="oklch(0.35 0.15 145)">
        <div className="space-y-2">
          {[
            { step: "01", title: "填写投入工时和产出价值", desc: "在任务编辑界面填写「投入工时（人天）」和「产出价值（元）」字段" },
            { step: "02", title: "点击「AI核算」按钮", desc: "在任务详情页点击「AI核算」，系统自动计算 ROI 并给出效益评级" },
            { step: "03", title: "查看核算报告", desc: "AI 生成完整的效益分析报告，包含 ROI 评级、奖金预估、改进建议" },
            { step: "04", title: "查看积分排行", desc: "进入「积分看板」页面查看各部门和个人的综合效益排名" },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-sm" style={{ background: 'oklch(0.97 0.004 80)', border: '1px solid oklch(0.90 0.008 75)' }}>
              <div className="shrink-0 w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold font-mono" style={{ background: 'oklch(0.35 0.12 200)', color: 'oklch(0.98 0.002 60)' }}>{s.step}</div>
              <div>
                <div className="text-xs font-semibold text-foreground mb-0.5">{s.title}</div>
                <div className="text-[11px] text-muted-foreground">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="p-4 rounded-sm text-xs" style={{ background: 'oklch(0.97 0.04 75)', border: '1px solid oklch(0.82 0.10 75)' }}>
        <div className="font-semibold mb-2" style={{ color: 'oklch(0.45 0.12 75)' }}>💡 核算建议</div>
        <ul className="space-y-1 text-muted-foreground">
          <li><ChevronRight size={10} className="inline mr-1" />产出价值建议保守估算，以实际可追溯的数据为准（如合同金额、节省费用等）</li>
          <li><ChevronRight size={10} className="inline mr-1" />投入工时应包含所有参与人员，不能只填负责人工时</li>
          <li><ChevronRight size={10} className="inline mr-1" />ROI 高于 200% 的任务优先获得资源支持和奖金倾斜</li>
          <li><ChevronRight size={10} className="inline mr-1" />每月末汇总效益数据，作为下月资源配置的重要依据</li>
        </ul>
      </div>
    </div>
  );
}

// ─── 操作流程 ───────────────────────────────────────────────
function WorkflowTab() {
  const steps = [
    {
      step: "01",
      title: "登录系统",
      desc: "使用分配的账号密码登录。总管理员可查看所有部门；部门账号只能查看本部门内容。",
      tips: ["首次登录请修改默认密码", "忘记密码联系总管理员重置"],
    },
    {
      step: "02",
      title: "查看战略总览",
      desc: "（仅管理员）进入战略总览页，查看全局任务状态、卡点预警、月度里程碑和各部门进度对比。",
      tips: ["红色卡点标记需优先处理", "点击部门卡片可快速跳转"],
    },
    {
      step: "03",
      title: "进入部门看板",
      desc: "选择对应部门，查看该部门的年度目标、任务卡片（按状态分组）、里程碑时间轴和成员列表。",
      tips: ["任务按「进行中→有卡点→待启动→已完成」排列", "点击任务卡片查看完整详情"],
    },
    {
      step: "04",
      title: "新增/编辑任务",
      desc: "点击「新增任务」按钮创建任务，填写所有必填字段。编辑现有任务点击任务卡片右上角的编辑按钮。",
      tips: ["负责人和成员可从钉钉通讯录选取", "产出附件支持图片和文档上传"],
    },
    {
      step: "05",
      title: "更新任务进展",
      desc: "定期更新「当前进展」字段，上传产出附件作为完成证明，修改任务状态反映最新情况。",
      tips: ["建议每周至少更新一次", "有卡点时必须填写突破点说明"],
    },
    {
      step: "06",
      title: "查看积分与奖金",
      desc: "AI核算引擎每日自动计算积分和奖金预估。在「积分排行」页面查看各部门排名和个人贡献度。",
      tips: ["积分实时更新", "月末结算时以当日数据为准"],
    },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-sm text-muted-foreground mb-2">
        按照以下步骤使用看板系统，确保任务数据准确完整，以便AI引擎正确核算积分和奖金。
      </div>
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4">
          <div
            className="shrink-0 w-10 h-10 rounded-sm flex items-center justify-center text-sm font-bold font-mono"
            style={{ background: 'oklch(0.42 0.18 22)', color: 'oklch(0.98 0.002 60)' }}
          >
            {s.step}
          </div>
          <div className="flex-1 pb-4 border-b border-dashed border-border">
            <h4 className="text-sm font-semibold text-foreground mb-1" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              {s.title}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.desc}</p>
            <div className="flex flex-wrap gap-2">
              {s.tips.map((tip, j) => (
                <span
                  key={j}
                  className="text-[10px] px-2 py-0.5 rounded-sm"
                  style={{ background: 'oklch(0.94 0.008 75)', border: '1px solid oklch(0.86 0.012 75)', color: 'oklch(0.42 0.015 60)' }}
                >
                  💡 {tip}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 通用区块组件 ───────────────────────────────────────────
function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"
        style={{ fontFamily: "'Noto Serif SC', serif" }}
      >
        <span className="w-1 h-4 rounded-sm inline-block shrink-0" style={{ background: accent }} />
        {title}
      </h3>
      {children}
    </div>
  );
}
