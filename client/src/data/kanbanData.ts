// TTP2026 AI战略看板数据
// 设计风格：纸质战情室（War Room Paper）- 朱红主色 + 米白底色 + 深墨文字

export interface Task {
  id: string;
  name: string;
  goal: string;
  strategy: string;
  actions: string[];
  milestone: string;
  result: string;
  breakthrough: string;
  manager: string;
  contributors: string[];
  dingDeptIds?: string[];
  deadline: string;
  status: "进行中" | "已完成" | "待启动" | "有卡点" | "已结束";
  rewardPool?: string;
  completionRate?: number;
  inputManDays?: number;
  outputValue?: number;
  score?: number;
}

export interface Milestone {
  date: string;
  event: string;
  status: "completed" | "in-progress" | "upcoming";
}

export type Committee = Department;
export interface Department {
  id: string;
  shortName: string;
  fullName: string;
  color: string;
  icon: string;
  chairman: string;
  director?: string;
  members: string[];
  responsibility: string[];
  annualGoal: string;
  conditions: string[];
  rewardPool: string;
  tasks: Task[];
  milestones: Milestone[];
}

export const committees: Department[] = [
  {
    id: "qianwei",
    shortName: "前委会",
    fullName: "集团前线委员会",
    color: "#C0392B",
    icon: "⚔️",
    chairman: "肖俊杰",
    director: "陈维维",
    members: ["蒋荣玉", "张文", "王梦娟", "高幸", "冯文军", "何佩佩"],
    responsibility: ["销售/售后资源统一调度", "培养销售干部", "搭建销售体系", "提升销售力", "提升人效", "新产品突破", "业绩增量突破"],
    annualGoal: "三体人销售突击队建设，业绩增量突破，人效持续提升",
    conditions: ["集团业绩完成率超过60%", "业绩增量", "人效提升", "销售力提升"],
    rewardPool: "增量产出净利润3% + 战区分仓/分局利润0.6%",
    tasks: [
      {
        id: "qw-1",
        name: "老板良三三制销售突破",
        goal: "老板良业务月度业绩持续增长，三三制流程闭环落地",
        strategy: "三三制工作模式：线索组→方案组→交付组，末尾淘汰激励",
        actions: [
          "分局分仓销售售后体系培训",
          "每天发各平台告知视频/海报/销售话术",
          "收集高价值线索转化为卖点",
          "老板良官网推广计划制定",
          "战区展会活动方案落地"
        ],
        milestone: "月度业绩15600→52049元，三三制队伍12人成型",
        result: "电话量993，有效电话453（45%），线索142，完成三三制奖金包方案",
        breakthrough: "高价值线索识别，三三制协同能力（线索共享）",
        manager: "张文",
        contributors: ["张文", "邵明铭", "张雯", "蒋荣玉"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "PK奖励 + 奖金池"
      },
      {
        id: "qw-2",
        name: "小渲风三三制业务推进",
        goal: "小渲风业务域月度业绩目标81000元，三三制流程成熟",
        strategy: "线索组/方案组/交付组三线并进，聚焦名单质量与演示转化",
        actions: [
          "名单消耗与有效通话率提升",
          "商机组演示框架迭代",
          "老客户回访计划启动",
          "效果图案例库扩充",
          "新疆/常州运营中心人员补充"
        ],
        milestone: "9月成交9800元，名单801条，线索380条，商机71条",
        result: "上周业绩52049.5元，有效通话47%，微信添加26%，预约演示17个",
        breakthrough: "销售能力，市场调研能力，产品研发能力",
        manager: "冯文军",
        contributors: ["冯文军", "王娟", "汪远鹏", "陈彩彩", "熊艳丽", "沈聪"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "PK奖励 + 转化单量计件 + 成交实时红包"
      },
      {
        id: "qw-3",
        name: "竞品攻坚地推行动",
        goal: "苏锡常地区竞品客户转化，地推业绩成交",
        strategy: "地推团队打卡制度，城市名单精准攻坚",
        actions: [
          "城市名单列表制定",
          "分局恳谈与动员",
          "地推团队打卡执行",
          "成交案例统计与复盘"
        ],
        milestone: "地推团队开始打卡，两日打卡量10家，上周成交1个客户业绩6180",
        result: "太湖无锡分局地推效率需提升，迭代出更高效地推方案",
        breakthrough: "地推攻坚能力，人员恳谈能力",
        manager: "蒋荣玉",
        contributors: ["张芹", "蒋荣玉", "何佩佩", "薛晓琪"],
        deadline: "2025-09-30",
        status: "有卡点",
        rewardPool: "计件奖励"
      },
      {
        id: "qw-4",
        name: "售后AI客服系统上线",
        goal: "AI客服测试链接问题90%正确解答率，顺风耳系统深度应用",
        strategy: "分仓售后流程标准化 + AI客服系统集成",
        actions: [
          "新格尔家具系列产品服务流程标准白皮书框架完成",
          "AI客服测试链接达标",
          "顺风耳工单流转上线",
          "售后群公告功能排期上线",
          "服务质量报告正式版发布"
        ],
        milestone: "顺风耳APP更新iOS版本，售后群增加开始/结束服务功能，未读逻辑优化",
        result: "工单流转预计9.4-9.14上线，售后群公告排期9.19",
        breakthrough: "数字化工具应用能力，顺风耳系统深度操作，AI协同能力",
        manager: "王梦娟",
        contributors: ["王梦娟", "李华松", "梅钊", "费晓杰", "王永进", "唐峰"],
        deadline: "2025-09-30",
        status: "进行中",
        rewardPool: "年度服务满意度奖金包/复购奖金包"
      },
      {
        id: "qw-5",
        name: "三体人销售突击队组建",
        goal: "成立三体人销售突击队，完成销售演练与PK，准备销售材料",
        strategy: "组织销售PK，末尾淘汰，激励方案配套",
        actions: [
          "三体人销售突击队成立",
          "销售演练组织",
          "销售激励方案准备",
          "三体人演讲PPT和视频材料制作",
          "销售话术体系建立"
        ],
        milestone: "突击队成立，销售材料完备，首轮PK完成",
        result: "待启动",
        breakthrough: "三体人销售能力，激励机制设计",
        manager: "陈维维",
        contributors: ["肖俊杰", "陈维维", "蒋荣玉", "张文"],
        deadline: "2026-12-31",
        status: "待启动",
        rewardPool: "奖金池"
      },
      {
        id: "qw-6",
        name: "销售研发1+1",
        goal: "深入客户现场，精准定义AI可解决的业务痛点，完成MVP研发，实现“从场景到产品”的闭环验证",
        strategy: "选定2-3个高潜力目标客户；完成《客户痛点诊断报告》与《AI解决方案原型设计》",
        actions: [
          "任务1：客户筛选与预约（选择数字化意愿强、有明确效率痛点的客户）",
          "任务2：驻场/深度访谈（观察工作流，记录非结构化任务与重复性劳动）",
          "任务3：痛点定义与方案设计（将观察转化为具体的、可被AI解决的“功能点”）",
          "任务4：MVP开发与部署（与研发团队协作，快速打造可演示的解决方案）"
        ],
        milestone: "第1周完成客户选定与预约；第2-3周完成驻场与报告；第4周产出原型方案",
        result: "广州展会期间走访佛山老赖不赖、欧莱诺及星迪门窗，客户提出原材料价格实时调整、手绘窗型自动识别下单、材料信息识别转化公式三大AI需求，计划下周赴佛山凤池市场进一步深入沟通",
        breakthrough: "客户AI需求深度挖掘，可复制AI+业务解决方案包",
        manager: "蒋荣誉",
        contributors: ["蒋荣誉", "肖俊杰"],
        deadline: "2026-03-31",
        status: "进行中",
        completionRate: 35,
        rewardPool: "奖金池"
      },
      {
        id: "qw-7",
        name: "AI赋能客户会销",
        goal: "为客户的关键会议/营销活动提供全流程AI辅助，提升活动效果与客户满意度，打造标杆案例",
        strategy: "完成至少±1场由我方AI深度赋能的客户会销活动；产出《AI会销服务案例白皮书》",
        actions: [
          "任务1：挖掘客户会销需求（新品发布、招商会、客户答谢会等）",
          "任务2：方案设计（AI生成邀请函、宣传文案、PPT大纲、互动问答脚本、新闻通稿等）",
          "任务3：活动执行支持（AI数字人宣讲、AI实时生成会议纪要、AI生成短视频）",
          "任务4：复盘与素材打包（AI分析活动数据，一键生成全案复盘报告与宣传素材包）"
        ],
        milestone: "第1周锁定需求与签约；第2-3周完成物料制作与流程彩排；第4周活动执行并交付报告",
        result: "已与美亿门窗达成一致，计刓4月中旬启动会销模式；参加了京东发布会，初步探讨组织门窗工厂参观学习方案",
        breakthrough: "客户会销AI赋能模式，标杆案例可复制推广",
        manager: "蒋荣誉",
        contributors: ["蒋荣誉", "肖俊杰"],
        deadline: "2026-05-31",
        status: "进行中",
        completionRate: 25,
        rewardPool: "奖金池"
      },
      {
        id: "qw-8",
        name: "销售新人培训智能体",
        goal: "打造一个7x24小时在线AI导师，缩短新人上岗周期，标准化销售能力，提升团队整体人效与战力",
        strategy: "MVP阶段：上线具备智能问答与资料推送功能的聊天机器人；深化阶段：上线情景模拟陪练模块；闭环阶段：实现与CRM数据打通",
        actions: [
          "梳理所有培训材料，构建结构化知识库",
          "录制/撰写标杆销售对话案例",
          "成立项目组，召开启动会，明确各阶段交付物、负责人及时间表",
          "智能体正式上线，接入新员工培训流程"
        ],
        milestone: "3月31日前确认项目人员；智能体正式上线，接入新员工培训流程",
        result: "本周确认项目人员，待启动会召开",
        breakthrough: "销售培训标准化，AI导师个性化推送能力",
        manager: "陈维维",
        contributors: ["陈维维", "肖俊杰"],
        deadline: "2026-06-30",
        status: "待启动",
        completionRate: 5,
        rewardPool: "奖金池"
      }
    ,
    {
      id: 'qianwei-t1',
      name: '客户ai解决方案',
      status: 'inProgress',
      priority: 'high',
      description: '根据客户给的表格和ppt计算成本、利润',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "qianwei-t1-m1", "name": "报价9000，各岗位计件工资计算规则落地，数据校验无误 成本核算模块可自动关联配", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'qianwei-t2',
      name: '直营工厂客户跟进系统',
      status: 'todo',
      priority: 'medium',
      description: '能够一目了然了解资源根据情况',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "qianwei-t2-m1", "name": "可正常访问的客户资源可视化看板 角色权限体系与操作流程测试通过 完成与客户资源库", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'qianwei-t3',
      name: '全屋定制工厂专用展示型官网',
      status: 'todo',
      priority: 'medium',
      description: '包含电子产品画册与实景案例两大核心模块，适合业务员现场演示、客户扫码查看、线上推广获客',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "qianwei-t3-m1", "name": "电子产品画册与实景案例模块完整上线 扫码查看功能可用，二维码生成与访问统计正常 ", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
    milestones: [
      { date: "2025-08", event: "三三制奖金包方案确定，老板良官网上线", status: "completed" },
      { date: "2025-09", event: "地推攻坚启动，顺风耳工单流转上线", status: "completed" },
      { date: "2025-10", event: "AI客服达到90%解答率，小渲风月度业绩达标", status: "in-progress" },
      { date: "2025-12", event: "三体人销售突击队组建完成，首轮PK结束", status: "completed" },
      { date: "2026-01", event: "三体人销售体系全面铺开", status: "upcoming" }
    ]
  },
  {
    id: "huojunjun",
    shortName: "火箭军",
    fullName: "集团火箭军",
    color: "#E67E22",
    icon: "🚀",
    chairman: "",
    director: "李朝辉",
    members: ["冯勇皞", "刘伊萌", "田俊杰", "王慧", "王倩倩"],
    responsibility: ["产品线资源调度", "产品孵化", "产品线人才培养", "提升产品力"],
    annualGoal: "插件产品孵化上线，协助四大业务域三体人研发，插件转化对话模式",
    conditions: ["集团业绩完成率超过60%", "付费产品功能", "孵化新产品", "培养产品经理"],
    rewardPool: "新功能增量+付费产品功能孵化，业绩增量3-6%，核算周期3-6个月",
    tasks: [
      {
        id: "hj-1",
        name: "AIPPT智能体开发",
        goal: "AIPPT智能体正式上线，提升销售/设计效率",
        strategy: "Coze平台智能体开发，解决用户端口联动技术卡点",
        actions: [
          "Demo已完成（体验链接可用）",
          "开发进度达80%",
          "解决Coze平台与用户端口联动技术问题",
          "正式上线部署"
        ],
        milestone: "Demo完成，开发进度80%，待解决技术卡点后正式上线",
        result: "Demo可用，尚未正式上线，遇到Coze平台技术卡点",
        breakthrough: "Coze平台技术攻关，用户端口联动",
        manager: "李朝辉",
        contributors: ["李朝辉", "冯勇皞"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "业绩增量3-6%"
      },
      {
        id: "hj-2",
        name: "插件·自定义报价",
        goal: "收集10个意向客户并成交2单",
        strategy: "AI生成代码，优化报价效率，推广给销售团队",
        actions: [
          "意向客户收集（目标10个）",
          "内部协作卡点解决（业绩分配问题）",
          "推广方案制定",
          "成交跟进"
        ],
        milestone: "有意向客户2个，未达成成交，内部协作卡点待解决",
        result: "因责任人忙碌且内部协作卡点，未达成成交目标",
        breakthrough: "内部协作机制，推广能力",
        manager: "冯勇皞",
        contributors: ["冯勇皞", "李朝辉"],
        deadline: "2025-12-31",
        status: "已结束"
      },
      {
        id: "hj-3",
        name: "插件·门板下单重新推进",
        goal: "月度成交目标30单",
        strategy: "批量群发海报，销售活动推进，稳定增长",
        actions: [
          "批量群发海报执行",
          "销售活动策划",
          "客户跟进优化",
          "月度数据复盘"
        ],
        milestone: "成交从月初2单增长到12单（11月27日数据）",
        result: "实际增长10单，业绩增量明显，但未达30单目标",
        breakthrough: "销售活动效率，批量营销能力",
        manager: "刘伊萌",
        contributors: ["刘伊萌", "冯勇皞"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "业绩增量3-6%"
      },
      {
        id: "hj-4",
        name: "AI辅助产品设计上线",
        goal: "新功能小插件一周上线一个，AI生成前端页面+代码",
        strategy: "产品设计时生成前端页面+代码，交付研发微调即可上线",
        actions: [
          "培训产品经理使用MasterGo、Cursor",
          "AI生成原型覆盖率提升至100%",
          "联合研委会形成研发小组",
          "木工小程序等插件开发"
        ],
        milestone: "AI生成已上线，产品经理AI原型覆盖率达50%",
        result: "AI生成的功能已上线，遗留任务完成，部分产品仍需持续检查",
        breakthrough: "商业产品经理能力，新产品线孵化",
        manager: "汪桃先",
        contributors: ["汪桃先", "李朝辉", "祝方旭"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "业绩增量3-6%"
      },
      {
        id: "hj-5",
        name: "三体人插件对话化改造",
        goal: "将现有插件放入三体人，转化成对话模式",
        strategy: "协助四大业务域确定通用三体人，选精干力量研发",
        actions: [
          "四大业务域通用三体人需求确定",
          "插件对话化技术方案设计",
          "精干研发力量组建",
          "春节前完成主要功能迭代"
        ],
        milestone: "方案确定，研发团队组建，年前完成主要功能",
        result: "待启动，需与研委会协同",
        breakthrough: "插件对话化技术，三体人集成能力",
        manager: "李朝辉",
        contributors: ["李朝辉", "田俊杰", "王慧"],
        deadline: "2026-12-31",
        status: "待启动",
        rewardPool: "业绩增量3-6%"
      }
    ,
    {
      id: 'huojunjun-t1',
      name: '产品需要演示skill，直播',
      status: 'inProgress',
      priority: 'high',
      description: '直播任务',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "huojunjun-t1-m1", "name": "1、是个业务域的更新内容，达到每周更新，每周都进行直播；", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    milestones: [
      { date: "2025-08", event: "门板下单插件上线，AI辅助设计工具推广", status: "completed" },
      { date: "2025-11", event: "AIPPT Demo完成，门板下单12单", status: "completed" },
      { date: "2025-12", event: "AIPPT正式上线，自定义报价插件推广", status: "completed" },
      { date: "2026-01", event: "三体人插件对话化改造完成", status: "upcoming" },
      { date: "2026-02", event: "四大业务域三体人全面集成", status: "upcoming" }
    ]
  },
  {
    id: "yanwei",
    shortName: "研委会",
    fullName: "研发委员会",
    color: "#2980B9",
    icon: "🔬",
    chairman: "梁栋",
    director: "唐锋",
    members: ["杨明鑫", "周川", "刘家源", "张涛", "王淑仪"],
    responsibility: ["研发资源调度", "技术攻关", "研发人员培养", "产品稳定性保证"],
    annualGoal: "协助各事业部春节前完成三体人主产品线对接，技术攻坚，成本节约10%以上",
    conditions: ["集团业绩完成率超过60%", "成本节约10%以上", "体系打造可复制"],
    rewardPool: "技术攻坚节约成本的10%作为奖励，研发新人培养体系建设",
    tasks: [
      {
        id: "yw-1",
        name: "三体人主产品线对接",
        goal: "春节前完成各事业部三体人主产品线对接",
        strategy: "协助各事业部技术攻关，优先完成主产品线",
        actions: [
          "各事业部三体人需求梳理",
          "技术方案设计",
          "研发资源调度",
          "联调测试",
          "上线验收"
        ],
        milestone: "春节前完成至少一个业务域主产品线对接",
        result: "进行中，与火箭军协同推进",
        breakthrough: "三体人技术架构，跨部门协作",
        manager: "梁栋",
        contributors: ["梁栋", "唐锋", "杨明鑫", "周川", "刘家源"],
        deadline: "2026-12-31",
        status: "进行中",
        rewardPool: "节约成本10%奖励"
      },
      {
        id: "yw-2",
        name: "研发人员培养体系建设",
        goal: "建立可复制的研发新人培养体系",
        strategy: "体系打造 + 实战项目绑定，培养研发管理干部",
        actions: [
          "研发能力清单制定",
          "培养路径设计",
          "实战项目配套",
          "考核标准数字化",
          "体系文档化"
        ],
        milestone: "培养体系初版完成，试点项目启动",
        result: "体系框架设计中",
        breakthrough: "研发管理干部培养，体系可复制性",
        manager: "唐锋",
        contributors: ["唐锋", "梁栋", "张涛", "王淑仪"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "研发新人培养体系建设奖励"
      },
      {
        id: "yw-3",
        name: "产品稳定性保证",
        goal: "核心产品稳定性达标，降低客户投诉率",
        strategy: "与检委会联动，建立产品稳定性监控机制",
        actions: [
          "稳定性监控指标建立",
          "Bug修复优先级排序",
          "上线前测试流程规范",
          "客户反馈闭环机制"
        ],
        milestone: "产品稳定性报告发布，客户投诉率下降",
        result: "与检委会协同推进中",
        breakthrough: "产品质量管控，客户体验提升",
        manager: "周川",
        contributors: ["周川", "刘家源", "张涛"],
        deadline: "2025-12-31",
        status: "已结束"
      }
    ,
    {
      id: 'yanwei-t2',
      name: '制定前端项目暴露mcp的规范',
      status: 'todo',
      priority: 'medium',
      description: '',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "yanwei-t2-m1", "name": "已经跟小渲风项目沟通大致的结构，小渲风预计3.30日能给出初版，以及细节的规范文", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'yanwei-t3',
      name: 'agent生成 mcp tools/resources 的设计框架',
      status: 'todo',
      priority: 'medium',
      description: '',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "yanwei-t3-m1", "name": "在柜柜项目上，在最新的结合小软件与mcp的模式下，方向走偏。对于 agent 生", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
    milestones: [
      { date: "2025-09", event: "研发培养体系框架完成", status: "completed" },
      { date: "2025-12", event: "三体人技术方案确定，研发资源调度完成", status: "completed" },
      { date: "2026-01", event: "春节前完成主产品线三体人对接", status: "upcoming" },
      { date: "2026-03", event: "研发新人培养体系全面落地", status: "upcoming" }
    ]
  },
  {
    id: "zhengjiju",
    shortName: "政治局",
    fullName: "政治局",
    color: "#8E44AD",
    icon: "🏛️",
    chairman: "鲍乾",
    members: ["马东", "邵明铭"],
    responsibility: ["团结上下游", "孵化电商业务", "社群运营", "五金服务站", "同城工会", "提升供应链资源整合能力"],
    annualGoal: "工厂客户月度名单1000+，服务站总业绩10W+，AI智能体上线服务内外部客户",
    conditions: ["集团业绩完成率超过60%", "供应商名单量+线索+商机", "转化成交运营", "维护供应商"],
    rewardPool: "供应商资源转化提成3% + 社群运营线索转化提成3%",
    tasks: [
      {
        id: "zj-1",
        name: "社群运营7*8制度",
        goal: "7*8运营，321响应（问题处理效率），AI工具提升运营效率20%",
        strategy: "供应链资源和需求关系梳理，打造社群良好氛围，电商业务引导",
        actions: [
          "五金/安装/代工厂等项目入驻推进",
          "社群运营项目、同城工会项目",
          "联合营销活动",
          "上下游合作伙伴添加与维护",
          "AI工具辅助运营效率提升"
        ],
        milestone: "9月累计新增安装工65名，代工厂5名，五金核销19单流水39830元",
        result: "8月总结：安装入驻185名，代工厂32名，五金核销12单，安装核销6单",
        breakthrough: "现金流测算，业绩增量，AI运营效率提升",
        manager: "鲍乾",
        contributors: ["鲍乾", "邵明铭"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "社群运营线索转化提成3%"
      },
      {
        id: "zj-2",
        name: "政治局AI智能体",
        goal: "AI智能体建设，能自主服务内部人员以及外部客户",
        strategy: "内容建设→智能体搭建→内测迭代→推广",
        actions: [
          "六项业务框架规划（平台券/社群运营/供应链/电商/服务站等）",
          "26条细分问答知识内容建设",
          "Coze平台智能体搭建",
          "内测调研35人，解决55条问题",
          "推广告知方案制定"
        ],
        milestone: "首版问答智能体完成内测，解答率78.57%，待前端上线",
        result: "知识库建设完成，内测体验良好，前端开发人手吃紧待上线",
        breakthrough: "内容建设，智能体搭建，推广告知",
        manager: "马东",
        contributors: ["马东", "鲍乾", "邵明铭"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "效率提升奖励"
      },
      {
        id: "zj-3",
        name: "上下游线索获取",
        goal: "工厂客户月度名单1000+，服务站客户名单200+",
        strategy: "线索来源渠道拓宽，已有服务商维护与更多合作",
        actions: [
          "优化客户背景调研流程，精准分析需求痛点",
          "联合营销活动",
          "上下游合作伙伴添加与维护",
          "行业展会线下渠道获取名单",
          "线上数据平台获取名单",
          "AI辅助名单筛选"
        ],
        milestone: "9月工厂客户名单总量3679条，深度跟进20个（添加微信6个）",
        result: "8月目标达成：工厂客户1000+，服务站客户200+",
        breakthrough: "名单质量，成熟的AI列名单方法",
        manager: "鲍乾",
        contributors: ["鲍乾", "邵明铭"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "供应商资源转化提成3%"
      },
      {
        id: "zj-4",
        name: "服务站建设",
        goal: "持续裂变孵化服务站（每月新增一个），总业绩稳定10W+",
        strategy: "提高销售力，裂变更多服务站",
        actions: [
          "多产品培训、销售经验研讨分享",
          "宣传资料导入",
          "承接服务站线索，优化沟通话术",
          "告知方案优化"
        ],
        milestone: "8月总业绩产出82560元",
        result: "正常业务开展，业绩稳定",
        breakthrough: "新站业绩产出测算，裂变机制",
        manager: "鲍乾",
        contributors: ["鲍乾", "邵明铭", "樊丽萍", "陈心月"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "服务站总业绩1%奖金包"
      }
    ],
    milestones: [
      { date: "2025-08", event: "工厂客户名单1000+达成，服务站业绩82560元", status: "completed" },
      { date: "2025-09", event: "AI智能体首版内测完成，名单3679条", status: "completed" },
      { date: "2025-10", event: "AI智能体前端上线，服务站月度新增1个", status: "in-progress" },
      { date: "2025-12", event: "上下游深度合作伙伴达10个", status: "completed" },
      { date: "2026-01", event: "三体人上下游供应链集成", status: "upcoming" }
    ]
  },
  {
    id: "shendunjv",
    shortName: "神盾局",
    fullName: "神盾局",
    color: "#16A085",
    icon: "🛡️",
    chairman: "杨明鑫",
    members: ["杜玄", "贺洋利", "刘嘉隆"],
    responsibility: ["预研+AI技术突破"],
    annualGoal: "AI技术突破，提升效率，成本节约，加入三体人研发",
    conditions: ["集团业绩完成率超过60%", "AI技术突破", "提升效率，成本节约"],
    rewardPool: "效率提升后成本及耗时节约20%，奖励节约成本的3%",
    tasks: [
      {
        id: "sd-1",
        name: "AI报价系统",
        goal: "提取表格样式→提取拆单数据→生成报价表格",
        strategy: "使用大模型提取JSON数据信息，映射到Excel模板，前端填充",
        actions: [
          "阿里百炼LLM提取JSON数据",
          "Excel模板字段映射分析",
          "前端模板填充功能开发",
          "8.27上测试服",
          "优化JSON数据区分板件与五金字段"
        ],
        milestone: "8.14完成基本效果交付，8.19优化JSON数据，8.27上测试服",
        result: "根据用户提供模版生成对应报价单，基本功能已实现",
        breakthrough: "LLM数据提取精度，Excel模板映射准确性",
        manager: "贺洋利",
        contributors: ["贺洋利", "刘嘉隆"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "节约成本3%奖励"
      },
      {
        id: "sd-2",
        name: "AI客服系统",
        goal: "通过柜柜产品文档，实现柜柜使用和问题排查的AI售后问答",
        strategy: "语义匹配+知识检索/重排序+回复润色+流式输出",
        actions: [
          "语义匹配（基于产品文档测试）",
          "知识检索/重排序（已完成）",
          "回复内容润色/聊天记忆（已完成）",
          "流式输出（已完成，待顺风耳对接）",
          "产品文档整理（进行中）"
        ],
        milestone: "待售后完善产品文档后测试，先实现产品手册基础上的AI辅助售后功能",
        result: "核心功能已完成，待产品文档完善后全面测试",
        breakthrough: "产品文档整理完整性，顺风耳对接",
        manager: "杜玄",
        contributors: ["杜玄", "贺洋利", "苏智骁"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "节约人力成本3%奖励"
      },
      {
        id: "sd-3",
        name: "门窗线性排样优化",
        goal: "更好的线性排样优化率和任务并行度，提高计算速度",
        strategy: "基于进程池的任务并行调度，分任务场景优化算法",
        actions: [
          "进程池并行调度实现",
          "小规模数据FFD算法优化",
          "大体量数据分支定价算法",
          "定尺优化和预料留存模式支持",
          "Linux环境迁移"
        ],
        milestone: "功能更新已上线测试服，配合运维排查服务故障并迁移Linux环境",
        result: "较高的排样优化率，较高的任务并行度，大体量数据排样结果改善",
        breakthrough: "并行能力和优化率提升",
        manager: "杜玄",
        contributors: ["杜玄"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "节约成本3%奖励"
      },
      {
        id: "sd-4",
        name: "小渲风HDR图像处理",
        goal: "HDR图像处理成JPG，识别过曝和过暗区域，自动调整增强细节",
        strategy: "通过相关图像模型处理，GPU移植加速计算",
        actions: [
          "HDRNet模型尝试部署",
          "Mantiuk色调映射算法GPU移植",
          "8.23完成GPU移植",
          "性能测试与优化"
        ],
        milestone: "8.23完成Mantiuk色调映射算法GPU移植，处理速度提升",
        result: "解决小渲风HDR图像光线过曝或过暗问题，AI方法自动处理",
        breakthrough: "GPU加速，图像质量提升",
        manager: "杜玄",
        contributors: ["杜玄", "苏智骁"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "效率提升奖励"
      }
    ,
    {
      id: 'shendunjv-t1',
      name: 'AI报价',
      status: 'inProgress',
      priority: 'high',
      description: '提取表格样式->提取我们拆单数据->生成表格',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "shendunjv-t1-m1", "name": "完成交付", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'shendunjv-t2',
      name: 'AI客服',
      status: 'todo',
      priority: 'medium',
      description: '通过柜柜产品文档等数据，实现柜柜使用和问题排查的ai售后问答',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "shendunjv-t2-m1", "name": "售后正整理相关数据", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'shendunjv-t3',
      name: '门窗线性排样优化率不高，任务并行性能较差',
      status: 'todo',
      priority: 'medium',
      description: '更好的线性排样优化率和任务并行度，提高计算速度',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "shendunjv-t3-m1", "name": "8月8号上线测试服", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'shendunjv-t4',
      name: '小渲风hdr图像处理',
      status: 'done',
      priority: 'low',
      description: 'hdr图像处理成jpg图片，可以识别过曝和过暗的区域，自动调整，然后增强细节等',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "shendunjv-t4-m1", "name": "完成交付", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    milestones: [
      { date: "2025-08", event: "AI报价基本功能交付，排样优化上测试服", status: "completed" },
      { date: "2025-09", event: "AI客服核心功能完成，HDR GPU移植完成", status: "completed" },
      { date: "2025-12", event: "AI客服与顺风耳对接上线，AI报价正式上线", status: "completed" },
      { date: "2026-01", event: "加入三体人研发，AI技术全面集成", status: "upcoming" }
    ]
  },
  {
    id: "ziguanwei",
    shortName: "资管委",
    fullName: "资产管理委员会",
    color: "#D4A017",
    icon: "💰",
    chairman: "曹薇",
    members: ["刘雨欣", "刘璐", "张敏"],
    responsibility: ["奋斗者公有资产管理", "提升组织力", "奋斗者体系打造"],
    annualGoal: "制定奋斗者三体人长期收益方案，奋斗者公分小程序显示长期收益",
    conditions: ["集团业绩完成率超过60%", "奋斗者资金投名状", "奋斗者分红", "奋斗者拟股权分红"],
    rewardPool: "资金额外收益1%（项目投资收益），付费服务：提供服务协议、资金分析、项目奖励方案",
    tasks: [
      {
        id: "zg-1",
        name: "奋斗者三体人长期收益方案",
        goal: "制定奋斗者三体人长期收益方案，激励长期奋斗",
        strategy: "结合三体人产品，设计奋斗者专属收益路径",
        actions: [
          "奋斗者现有收益体系梳理",
          "三体人产品收益分配设计",
          "长期收益方案文档化",
          "方案审批与公示"
        ],
        milestone: "方案初版完成，审批通过",
        result: "方案设计中",
        breakthrough: "收益分配公平性，长期激励效果",
        manager: "曹薇",
        contributors: ["曹薇", "刘雨欣", "刘璐", "张敏"],
        deadline: "2026-12-31",
        status: "进行中",
        rewardPool: "资金额外收益1%"
      },
      {
        id: "zg-2",
        name: "奋斗者公分小程序",
        goal: "奋斗者公分小程序上线，显示长期收益",
        strategy: "小程序开发，集成公分数据，实时显示收益",
        actions: [
          "小程序需求设计",
          "公分数据接口开发",
          "收益展示界面设计",
          "测试与上线"
        ],
        milestone: "小程序上线，奋斗者可查看实时公分和收益",
        result: "需求设计阶段",
        breakthrough: "数据实时性，用户体验",
        manager: "刘雨欣",
        contributors: ["刘雨欣", "曹薇", "张敏"],
        deadline: "2026-02-28",
        status: "待启动",
        rewardPool: "效率提升奖励"
      },
      {
        id: "zg-3",
        name: "内外部奋斗者体系打磨",
        goal: "内外部奋斗者体系完善，投名状机制落地",
        strategy: "与组织部协同，体系文档化，可复制推广",
        actions: [
          "奋斗者资格认定标准制定",
          "投名状机制设计",
          "分红方案制定",
          "拟股权分红方案设计",
          "体系培训与推广"
        ],
        milestone: "体系文档完成，首批奋斗者认定",
        result: "与组织部协同推进中",
        breakthrough: "体系可复制性，激励公平性",
        manager: "曹薇",
        contributors: ["曹薇", "刘璐", "张敏"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "咨询陪跑+人才库线索人头奖励"
      }
    ,
    {
      id: 'ziguanwei-t1',
      name: 'AI给大家发工资',
      status: 'inProgress',
      priority: 'high',
      description: '1.实现AI发布任务、验收任务、发放工资或者奖金 2.员工可抢单、提交任务成果',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "ziguanwei-t1-m1", "name": "1.实现对话意图识别、完成管理员固定密码验证、基础任务发布/抢单 2.普通用户注", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ziguanwei-t2',
      name: '外部奋斗者招募',
      status: 'todo',
      priority: 'medium',
      description: '招募外部奋斗者100人',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "ziguanwei-t2-m1", "name": "1.简化外部奋斗者入营的流程，以完成小任务或者直接在爱奋进社进行申请等形式取代之", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
    milestones: [
      { date: "2025-10", event: "奋斗者体系框架完成，人员更新接手日常事务", status: "completed" },
      { date: "2025-12", event: "长期收益方案审批通过", status: "completed" },
      { date: "2026-01", event: "奋斗者公分小程序上线", status: "upcoming" },
      { date: "2026-03", event: "内外部奋斗者体系全面落地", status: "upcoming" }
    ]
  },
  {
    id: "jianwei",
    shortName: "检委会",
    fullName: "检查委员会",
    color: "#7F8C8D",
    icon: "🔍",
    chairman: "罗伟",
    members: ["朱涛", "刘丹", "王平蕾"],
    responsibility: ["内外产品稳定性监控", "流程制度自查反馈", "成本控制--廉政监控"],
    annualGoal: "简化流程，产品稳定性保证，财务成本节约廉政自查",
    conditions: ["集团业绩完成率超过60%", "软件稳定性保证", "流程反馈通道检验", "财务成本节约"],
    rewardPool: "节约成本1%，产品检查与客户联动，降低退费和客户损失赔偿金额1%",
    tasks: [
      {
        id: "jw-1",
        name: "产品稳定性监控体系",
        goal: "建立内外产品稳定性监控机制，降低客户投诉率",
        strategy: "与研委会联动，建立监控指标，定期巡检",
        actions: [
          "稳定性监控指标体系建立",
          "定期巡检流程制定",
          "问题上报与处理机制",
          "客户反馈闭环"
        ],
        milestone: "监控体系上线，月度稳定性报告发布",
        result: "监控体系框架设计中",
        breakthrough: "监控覆盖率，问题响应速度",
        manager: "罗伟",
        contributors: ["罗伟", "朱涛", "刘丹"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "节约成本1%"
      },
      {
        id: "jw-2",
        name: "流程制度自查",
        goal: "流程反馈通道检验，制度执行情况自查",
        strategy: "定期自查，问题反馈，流程优化",
        actions: [
          "流程执行情况检查",
          "制度落实情况核查",
          "问题清单整理",
          "改进方案提出"
        ],
        milestone: "季度自查报告完成，流程优化建议提交",
        result: "正常推进中",
        breakthrough: "流程检查效率，问题发现率",
        manager: "朱涛",
        contributors: ["朱涛", "王平蕾"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "节约成本1%"
      },
      {
        id: "jw-3",
        name: "廉政监控与成本控制",
        goal: "财务成本节约，廉政自查，降低退费和客户损失",
        strategy: "成本控制机制建立，廉政风险排查",
        actions: [
          "成本控制指标制定",
          "廉政风险点梳理",
          "退费率监控",
          "客户损失赔偿管控"
        ],
        milestone: "廉政自查报告完成，退费率下降",
        result: "正常推进中",
        breakthrough: "成本节约效果，廉政风险防控",
        manager: "刘丹",
        contributors: ["刘丹", "王平蕾", "罗伟"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "节约成本1%+降低赔偿金额1%"
      }
    ,
    {
      id: 'jianwei-t1',
      name: '产品检测',
      status: 'inProgress',
      priority: 'high',
      description: '提升新客户成交效率及老客户复购率20%',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "jianwei-t1-m1", "name": "长期", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'jianwei-t2',
      name: '流程检测',
      status: 'todo',
      priority: 'medium',
      description: '提升跨部分协作效率20%',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "jianwei-t2-m1", "name": "/", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'jianwei-t3',
      name: '财务监管',
      status: 'todo',
      priority: 'medium',
      description: '降低成本浪费10%',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "jianwei-t3-m1", "name": "长期", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    milestones: [
      { date: "2025-09", event: "流程自查报告完成，监控体系框架确定", status: "completed" },
      { date: "2025-12", event: "产品稳定性监控体系上线", status: "completed" },
      { date: "2026-01", event: "廉政自查年度报告完成", status: "upcoming" },
      { date: "2026-03", event: "成本节约目标达成验收", status: "upcoming" }
    ]
  },
  {
    id: "haiwei",
    shortName: "海委会",
    fullName: "海外委员会",
    color: "#1ABC9C",
    icon: "🌏",
    chairman: "肖俊杰",
    members: ["汪桃先", "宋媛媛", "汪洪密"],
    responsibility: ["国际业务孵化"],
    annualGoal: "聚焦主产品，海外软件业务突破，越南门窗销售年度50W",
    conditions: ["集团业绩完成率超过60%", "海外软件业务", "海外板材业务（采购）", "海外合作设备商"],
    rewardPool: "软件提成10% + 合作业绩提成",
    tasks: [
      {
        id: "hw-1",
        name: "越南门窗销售",
        goal: "年度销售50W，越南当地团队服务",
        strategy: "越南当地团队服务，每月2次复盘会同步信息",
        actions: [
          "每月2次复盘会",
          "丁辰/邓锋直接入群对接客户",
          "技术问题优先级排序",
          "分框优化问题解决"
        ],
        milestone: "上周成交1套，开启第一次复盘会，针对技术问题优先级排序",
        result: "已开始运营，成交1套，复盘机制建立",
        breakthrough: "分框优化问题，本周内解决",
        manager: "汪桃先",
        contributors: ["汪桃先", "宋媛媛", "汪洪密"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "软件提成10%"
      },
      {
        id: "hw-2",
        name: "软件英文翻译优化",
        goal: "英文翻译转向客户发现，逐步完善翻译准确性",
        strategy: "局部翻译校对，客户使用过程中发现不合理翻译",
        actions: [
          "本轮翻译完成并发版",
          "翻译名词更加准确",
          "客户反馈收集",
          "维吾尔族语言翻译优化"
        ],
        milestone: "完成本轮翻译并发版，翻译准确率提升",
        result: "翻译工作持续进行，维语字体更换和文本翻译迭代优化",
        breakthrough: "翻译名词准确性，多语言支持",
        manager: "汪桃先",
        contributors: ["汪桃先", "宋媛媛"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "软件提成10%"
      },
      {
        id: "hw-3",
        name: "海外合伙人方案",
        goal: "发展海外经销商，建立合伙人体系",
        strategy: "关注上游，发展客户为经销商，合伙人方案迭代",
        actions: [
          "海外销售案例积累",
          "合伙人方案迭代",
          "上游资源开发",
          "经销商体系建立"
        ],
        milestone: "合伙人方案迭代完成，首批经销商签约",
        result: "海外销售案例较少，现有客户难形成转介绍，方案需迭代",
        breakthrough: "经销商体系建立，上游资源开发",
        manager: "汪桃先",
        contributors: ["汪桃先", "汪洪密"],
        deadline: "2026-03-31",
        status: "有卡点",
        rewardPool: "合作业绩提成"
      }
    ,
    {
      id: 'haiwei-t1',
      name: '越南门窗销售',
      status: 'inProgress',
      priority: 'high',
      description: '年度销售50W',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "haiwei-t1-m1", "name": "8月15号", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'haiwei-t2',
      name: '柜柜海外用户市场调研',
      status: 'todo',
      priority: 'medium',
      description: '',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "haiwei-t2-m1", "name": "完成交付", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'haiwei-t3',
      name: '发展海外合伙人制度',
      status: 'todo',
      priority: 'medium',
      description: '',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "haiwei-t3-m1", "name": "完成交付", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'haiwei-t4',
      name: '柜柜海外版本迭代',
      status: 'done',
      priority: 'low',
      description: '',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "haiwei-t4-m1", "name": "完成交付", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'haiwei-t5',
      name: '门窗CC海外版本迭代',
      status: 'done',
      priority: 'low',
      description: '',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "haiwei-t5-m1", "name": "完成交付", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
    milestones: [
      { date: "2025-08", event: "越南门窗软件翻译优化完成，柜柜双屏版海外版需求确认", status: "completed" },
      { date: "2025-09", event: "越南首单成交，复盘机制建立", status: "completed" },
      { date: "2025-12", event: "越南市场月度稳定成交，合伙人方案迭代完成", status: "completed" },
      { date: "2026-03", event: "海外年度销售50W目标达成", status: "upcoming" }
    ]
  },
  {
    id: "zuzhihu",
    shortName: "组织部",
    fullName: "组织部",
    color: "#2C3E50",
    icon: "🏗️",
    chairman: "",
    director: "欧阳怡琪",
    members: ["曹薇", "李春莲", "王雨新", "王家东", "孙丹丹"],
    responsibility: ["组织力打造", "干部体系改革", "人才库建设", "能力清单+晋升体系落地", "体系建设落地", "干部培养", "大队培训"],
    annualGoal: "自行研发人力资源相关三体人，更新三体人介绍，官网内容和招聘平台内容更新",
    conditions: ["集团业绩完成率超过60%", "招聘达标", "利润>0"],
    rewardPool: "咨询陪跑+人才库线索人头+内外奋斗者人头升级+集团战略项目落地",
    tasks: [
      {
        id: "zz-1",
        name: "人力资源三体人研发",
        goal: "自行研发人力资源相关三体人",
        strategy: "结合HR业务场景，设计三体人功能模块",
        actions: [
          "HR业务场景梳理",
          "三体人功能需求设计",
          "研发资源协调",
          "内测与迭代",
          "正式上线推广"
        ],
        milestone: "HR三体人首版上线，内部使用",
        result: "需求设计阶段",
        breakthrough: "HR场景AI化，效率提升",
        manager: "欧阳怡琪",
        contributors: ["欧阳怡琪", "曹薇", "李春莲"],
        deadline: "2026-02-28",
        status: "待启动",
        rewardPool: "集团战略项目落地奖励"
      },
      {
        id: "zz-2",
        name: "干部培养体系建设",
        goal: "能力清单+晋升体系落地，干部培养可复制",
        strategy: "与前委/火箭军等强绑定，实战项目培养",
        actions: [
          "能力清单制定",
          "晋升体系设计",
          "培训课程开发",
          "实战项目配套",
          "考核标准数字化（认证通过率≥90%）"
        ],
        milestone: "能力清单完成，晋升体系初版发布，首批干部认证",
        result: "正常项目推进中",
        breakthrough: "干部培养效率，体系可复制性",
        manager: "李春莲",
        contributors: ["李春莲", "欧阳怡琪", "何佩佩"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "人才库线索人头奖励"
      },
      {
        id: "zz-3",
        name: "官网与招聘平台内容更新",
        goal: "更新三体人介绍，官网内容和招聘平台内容",
        strategy: "结合公司最新战略，全面更新对外展示内容",
        actions: [
          "三体人介绍内容撰写",
          "官网内容审核更新",
          "招聘平台JD更新",
          "公司文化宣传内容制作"
        ],
        milestone: "官网内容全面更新，招聘平台JD完善",
        result: "内容更新进行中",
        breakthrough: "内容质量，品牌形象提升",
        manager: "欧阳怡琪",
        contributors: ["欧阳怡琪", "王雨新"],
        deadline: "2025-12-31",
        status: "已结束"
      }
    ],
    milestones: [
      { date: "2025-09", event: "能力清单初版完成，干部培养方案确定", status: "completed" },
      { date: "2025-12", event: "晋升体系正式发布，官网内容更新完成", status: "completed" },
      { date: "2026-01", event: "HR三体人需求确定，研发启动", status: "upcoming" },
      { date: "2026-03", event: "HR三体人上线，干部培养体系全面落地", status: "upcoming" }
    ]
  },
  {
    id: "caiwubu",
    shortName: "财务部",
    fullName: "财务部",
    color: "#27AE60",
    icon: "📊",
    chairman: "付娟",
    director: "胡欣欣",
    members: ["李雪", "冒云霞"],
    responsibility: ["财务模型", "各业务预决算核算监督", "新业务盈亏平衡点", "打造财务体系", "培训财务BP"],
    annualGoal: "自行研发财务三体人，财务模型完善，各业务盈亏平衡点清晰",
    conditions: ["集团业绩完成率超过60%", "财务支持", "资金支持", "财务模型"],
    rewardPool: "节约成本，资金获得+提供财务分析报告获利",
    tasks: [
      {
        id: "cw-1",
        name: "财务三体人研发",
        goal: "自行研发财务三体人，提升财务工作效率",
        strategy: "结合财务业务场景，AI辅助财务分析和报告",
        actions: [
          "财务业务场景梳理",
          "财务三体人功能设计",
          "研发资源协调（技术支持，优先级排序中）",
          "内测与迭代",
          "正式上线"
        ],
        milestone: "财务三体人首版上线，财务工作效率提升20%",
        result: "卡点属于技术类，需技术支持，优先级排序中",
        breakthrough: "财务场景AI化，报告自动化",
        manager: "付娟",
        contributors: ["付娟", "胡欣欣", "李雪"],
        deadline: "2026-02-28",
        status: "有卡点",
        rewardPool: "节约成本奖励"
      },
      {
        id: "cw-2",
        name: "各业务盈亏平衡点核算",
        goal: "新业务盈亏平衡点清晰，各业务预决算核算监督",
        strategy: "财务模型建立，各业务域财务BP培训",
        actions: [
          "各业务域财务模型建立",
          "盈亏平衡点测算",
          "预决算核算流程规范",
          "财务BP培训"
        ],
        milestone: "各业务域盈亏平衡点报告完成，财务BP培训完成",
        result: "正常推进中",
        breakthrough: "财务模型准确性，BP培训效果",
        manager: "胡欣欣",
        contributors: ["胡欣欣", "李雪", "冒云霞"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "财务分析报告获利"
      }
    ],
    milestones: [
      { date: "2025-10", event: "各业务财务模型初版完成", status: "completed" },
      { date: "2025-12", event: "财务BP培训完成，盈亏平衡点报告发布", status: "completed" },
      { date: "2026-01", event: "财务三体人技术卡点解决，研发启动", status: "upcoming" },
      { date: "2026-03", event: "财务三体人上线，财务体系全面数字化", status: "upcoming" }
    ]
  },
  {
    id: "dangzuzhi",
    shortName: "党组织",
    fullName: "党组织",
    color: "#E74C3C",
    icon: "🎖️",
    chairman: "王丹",
    members: ["陆长扣", "王旋", "王平蕾", "范蕾红", "张甜甜"],
    responsibility: ["党建联盟", "内外部奋斗发掘", "干部筛选监督"],
    annualGoal: "党建联盟建设，公众号粉丝突破，品牌文化宣传，发掘外部奋斗者",
    conditions: ["集团业绩完成率超过60%", "党建联盟推动供应链", "发展外部奋斗者", "党建宣传，品牌文化建设"],
    rewardPool: "申报获奖获得荣誉+发掘外部奋斗者+建设党建联盟+工会效应",
    tasks: [
      {
        id: "dz-1",
        name: "党建文化告知项目",
        goal: "搭建党建宣发体系，提升企业品牌价值，公众号粉丝50+",
        strategy: "多渠道宣传（抖音/快手/公众号/官网/工会）",
        actions: [
          "公众号账号注册与基础建设",
          "联合工会公众号建号",
          "新格尔周报每周发布",
          "政策查询菜单建设（4个热门省份）",
          "AI辅助政策收集",
          "党建联盟新增一家"
        ],
        milestone: "公众号粉丝50+，阅读及曝光量破千，品牌宣发获取客户有效建议5个",
        result: "公众号已完成注册，首篇文章发布，两期周报发布，江苏/浙江政策收录完成",
        breakthrough: "党组织账号搭建从0-1，结合AI做政策收集",
        manager: "王丹",
        contributors: ["王丹", "陆长扣", "张甜甜"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "申报获奖获得荣誉奖励"
      },
      {
        id: "dz-2",
        name: "外部奋斗者发掘",
        goal: "发展外部奋斗者，扩大奋斗者队伍",
        strategy: "通过党建联盟和工会渠道，发掘有潜力的外部奋斗者",
        actions: [
          "外部奋斗者画像梳理",
          "发掘渠道建立",
          "接触与评估",
          "引入与培养"
        ],
        milestone: "首批外部奋斗者引入，奋斗者队伍扩大",
        result: "正常推进中",
        breakthrough: "外部奋斗者质量，引入效率",
        manager: "陆长扣",
        contributors: ["陆长扣", "王旋", "王平蕾"],
        deadline: "2025-12-31",
        status: "已结束",
        rewardPool: "发掘外部奋斗者人头奖励"
      }
    ,
    {
      id: 'dangzuzhi-t1',
      name: '打造“智慧党建、法务服务、政策解读”的“AI三体人”',
      status: 'inProgress',
      priority: 'high',
      description: '每个项目设立第一责任人，统领落地全过程。',
      assignee: '',
      dueDate: '2026-06-30',
      tags: ['关键任务'],
      milestones: [{"id": "dangzuzhi-t1-m1", "name": "46112", "completed": false, "dueDate": "2026-06-30"}],
      inputManDays: 10,
      outputValue: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
    milestones: [
      { date: "2025-08", event: "公众号账号注册完成，首篇文章发布", status: "completed" },
      { date: "2025-09", event: "两期周报发布，智能菜单上线，政策收录完成", status: "completed" },
      { date: "2025-10", event: "阅读量破千，党建联盟新增一家", status: "in-progress" },
      { date: "2025-12", event: "公众号粉丝70+，四省政策全覆盖", status: "completed" },
      { date: "2026-01", event: "党建联盟推动供应链合作落地", status: "upcoming" }
    ]
  },
  // 参谋部
  {
    id: "canmoubu",
    shortName: "参谋部",
    fullName: "集团参谋部",
    color: "#2471A3",
    icon: "📣",
    chairman: "肖俊杰",
    director: "",
    members: ["陈维维", "梁栋", "付娟", "欧阳怡琢"],
    responsibility: ["宣发推广与品牌传播", "引流获客策划", "内容策划与创意设计", "AI数字人建设与运营", "多平台流量运营"],
    annualGoal: "构建三体人AI数字人宣传矩阵，实现全渠道引流增长，年度引流转化目标600万",
    conditions: ["集团业绩完成率超过60%", "AI数字人上线运行", "引流转化指标达标"],
    rewardPool: "引流转化奖励 + 品牌价值提升分成",
    tasks: [
      {
        id: "cm-1",
        name: "AI数字人宣传矩阵建设",
        goal: "打造三体人品牌专属AI数字人，实现全天候自动化内容产出与多平台分发",
        strategy: "AI数字人形象设计 + 内容模板化 + 多平台自动分发流程搭建",
        actions: [
          "AI数字人形象设计与训练",
          "内容脚本模板库建立（产品介绍/客户案例/行业洞察）",
          "抖音/视频号/公众号多平台运营流程",
          "每周产出3条以上AI数字人视频",
          "视频数据监测与内容迭代优化"
        ],
        milestone: "AI数字人首次亮相，单视频播放量超过1万",
        result: "数字人形象设计中，内容模板库建立中",
        breakthrough: "AI数字人逼真度与内容质量，平台流量转化率",
        manager: "陈维维",
        contributors: ["陈维维", "肖俊杰", "梁栋"],
        deadline: "2026-03-31",
        status: "进行中",
        completionRate: 35,
        rewardPool: "引流转化奖励"
      },
      {
        id: "cm-2",
        name: "全渠道引流与私域流量运营",
        goal: "构建公域引流+私域转化闭环体系，实现每月新增有效线索500+",
        strategy: "多平台内容引流 + 社群私域活化 + SOP转化流程标准化",
        actions: [
          "抖音/小红书/视频号内容引流策略制定",
          "微信社群私域流量运营SOP建立",
          "引流个人号矩阵搭建（10个以上）",
          "线索分级运营与转化跟进",
          "每月引流数据复盘与策略迭代"
        ],
        milestone: "私域社群超过1000人，每月有效线索超过200条",
        result: "引流个人号矩阵搭建中，SOP制定中",
        breakthrough: "内容吸引力与线索转化率，私域活跃度",
        manager: "付娟",
        contributors: ["付娟", "陈维维", "梁栋"],
        deadline: "2026-06-30",
        status: "进行中",
        completionRate: 20,
        rewardPool: "引流转化奖励"
      },
      {
        id: "cm-3",
        name: "内容策划与宣发方案体系",
        goal: "建立标准化内容策划体系，实现产品宣发内容的持续产出与全面覆盖",
        strategy: "内容日历制度 + 第三方合作 + 用户口碑内容共创",
        actions: [
          "每周内容日历制定与执行",
          "三体人客户案例内容包装与分发",
          "行业媒体/KOL合作宣发",
          "用户口碑视频征集与激励",
          "宣发效果数据监测与复盘"
        ],
        milestone: "内容体系建立，每周稳定产出5条以上内容",
        result: "内容日历制定中，首批宣发方案设计中",
        breakthrough: "内容产出效率与品质，宣发覆盖范围扩大",
        manager: "欧阳怡琢",
        contributors: ["欧阳怡琢", "付娟", "梁栋"],
        deadline: "2026-09-30",
        status: "待启动",
        completionRate: 10,
        rewardPool: "品牌价值提升分成"
      }
    ],
    milestones: [
      { date: "2026-02", event: "AI数字人首次亮相，多平台同步发布", status: "in-progress" },
      { date: "2026-04", event: "私域社群超过1000人，引流闭环跑通", status: "upcoming" },
      { date: "2026-07", event: "内容体系建立，宣发覆盖全面提升", status: "upcoming" },
      { date: "2026-12", event: "全渠道引流转化体系成熟，年度目标达成", status: "upcoming" }
    ]
  },
  // 政治部
  {
    id: "zhengzhibu",
    shortName: "政治部",
    fullName: "集团政治部",
    color: "#1E8449",
    icon: "🎓",
    chairman: "王丹",
    director: "欧阳怡琪",
    members: ["陆长扣", "王旋", "范蕾红", "张甜甜", "李春莲"],
    responsibility: ["培训课程认证与体系建设", "三体人教学内容创建", "内部讲师培养与认证", "学习型组织建设", "知识体系与能力地图"],
    annualGoal: "构建三体人完整培训认证体系，创建系列化教学内容，让每个员工都能成为三体人的传播者和教学者",
    conditions: ["集团业绩完成率超过60%", "培训课程认证体系建完", "内部讲师队伍建立", "学习型组织建设完成"],
    rewardPool: "培训认证项目奖励 + 教学成果转化分成",
    tasks: [
      {
        id: "zz-p1",
        name: "三体人培训课程认证体系建设",
        goal: "构建完整的三体人培训课程认证体系，形成标准化课程目录与认证流程",
        strategy: "课程体系设计 + 认证标准建立 + 内部讲师认证 + 学员考核机制",
        actions: [
          "三体人核心课程体系设计（初级/中级/高级）",
          "课程认证标准与考核机制建立",
          "内部讲师资质认证流程设计",
          "线上+线下混合学习平台搭建",
          "课程效果评估与持续优化机制"
        ],
        milestone: "完整课程体系发布，首批内部讲师认证完成",
        result: "课程体系设计中，认证标准草案完成",
        breakthrough: "课程质量与学员通过率，讲师队伍建设",
        manager: "王丹",
        contributors: ["王丹", "陆长扣", "范蕾红"],
        deadline: "2026-06-30",
        status: "进行中",
        completionRate: 30,
        rewardPool: "培训认证项目奖励"
      },
      {
        id: "zz-p2",
        name: "三体人教学内容创建工程",
        goal: "创建系列化三体人教学内容，包括视频课程、案例库、工具包等多形态教学资源",
        strategy: "AI辅助内容创作 + 实战案例沉淀 + 多媒体教学资源开发",
        actions: [
          "三体人核心理念与方法论视频课程录制",
          "行业应用案例库建立（50个以上案例）",
          "AI工具使用教学视频系列（20集以上）",
          "三体人实战工具包与模板库开发",
          "教学内容定期更新与版本管理机制"
        ],
        milestone: "首期视频课程上线，案例库达到20个以上",
        result: "课程脚本撰写中，首批案例整理完成",
        breakthrough: "教学内容质量与实用性，学员学习完成率",
        manager: "李春莲",
        contributors: ["李春莲", "王旋", "张甜甜"],
        deadline: "2026-09-30",
        status: "进行中",
        completionRate: 25,
        rewardPool: "教学成果转化分成"
      },
      {
        id: "zz-p3",
        name: "学习型组织建设与奋斗者文化传承",
        goal: "建立学习型组织文化，通过培训体系强化奋斗者精神，打造持续学习的团队氛围",
        strategy: "学习积分制度 + 奋斗者荣誉体系 + 内部知识分享文化",
        actions: [
          "学习积分制度设计与实施",
          "奋斗者荣誉体系与表彰机制建立",
          "每月内部知识分享会制度",
          "三体人文化手册编写与发布",
          "新员工入职培训体系完善"
        ],
        milestone: "学习积分制度上线，首次奋斗者表彰活动举办",
        result: "积分制度设计中，荣誉体系方案完成",
        breakthrough: "员工学习参与率，奋斗者文化认同度",
        manager: "欧阳怡琪",
        contributors: ["欧阳怡琪", "王丹", "陆长扣"],
        deadline: "2026-12-31",
        status: "待启动",
        completionRate: 15,
        rewardPool: "培训认证项目奖励"
      }
    ],
    milestones: [
      { date: "2026-03", event: "培训课程认证体系发布，首批讲师认证", status: "in-progress" },
      { date: "2026-06", event: "首期视频课程上线，案例库建立", status: "upcoming" },
      { date: "2026-09", event: "教学内容体系完整，学习型组织建设完成", status: "upcoming" },
      { date: "2026-12", event: "三体人培训品牌成型，奋斗者文化全面落地", status: "upcoming" }
    ]
  }
];
// 总体战略目标
export const strategicGoal = {
  projectName: "AI战略转型",
  totalTarget: "600万",
  paths: [
    "四大业务域三体人预售",
    "装修行业CAD三体人预售",
    "构建四大业务域三体人整体解决方案"
  ],
  collaboration: "四大域，五大部，八大委",
  deadline: "2026-12-31"
};

// 月度战略路径
export const monthlyStrategy = [
  { month: "11月", focus: "为工厂量身打造智能体，培养工厂自己动手用AI编程，解决问题" },
  { month: "12月", focus: "四大业务域开放平台，与工厂智能体无缝集成，构建护城河，开启年费+用量付费模式" },
  { month: "2026年1月", focus: "工厂与智能体结合后，智能体自我进化。开始孵化基于产业互联网的数字工厂" },
  { month: "2026年2月", focus: "培养大量AI人才，建设三体研究所。销售人才、交付人才、研发人才全面培育，构建人才梯队" },
  { month: "2026年3月", focus: "跨行业，进军其他领域的AI业务。三体创作者已不局限于行业，向更广泛的市场延伸" },
  { month: "2026年4月", focus: "建设chatye产业软件开放平台，与其他行业软件公司合作。推动行业复用软件时代和互联网时代资产的变革（软件行业已没落，软件公司升级AI往往失败率最高）" },
  { month: "2026年5月", focus: "创作者平台上线，可派单给创作者，AI技能需要专业水平时委外创作。接通AI诊断，实现智能化任务分发与质量管控" }
];
