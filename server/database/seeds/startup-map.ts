// Seed data for the startup map knowledge tree
// Extracted from PRD Section 8

export interface SeedPoint {
  name: string;
  description: string;
}

export interface SeedTopic {
  name: string;
  description: string;
  points: SeedPoint[];
}

export interface SeedDomain {
  name: string;
  description: string;
  topics: SeedTopic[];
}

export const SEED_DOMAINS: SeedDomain[] = [
  // ===== 领域一：市场研究 =====
  {
    name: '市场研究',
    description: '了解目标市场规模、竞争格局和消费者需求',
    topics: [
      {
        name: '行业分析',
        description: '评估市场规模和发展趋势',
        points: [
          { name: '市场规模评估', description: '如何估算目标市场的总规模（TAM/SAM/SOM）' },
          { name: '行业趋势分析', description: '识别行业发展方向、增长驱动力和潜在风险' },
          { name: '市场细分', description: '按地理、人口、行为等维度划分市场' },
        ],
      },
      {
        name: '竞品分析',
        description: '研究竞争对手的产品和策略',
        points: [
          { name: '竞品识别与分类', description: '找到直接竞品、间接竞品和潜在竞品' },
          { name: '竞品产品对比', description: '产品特性、价格、定位、优劣势分析' },
          { name: '竞品营销策略分析', description: '研究竞品的渠道、内容、定价策略' },
        ],
      },
      {
        name: '消费者研究',
        description: '深入了解目标客户群体',
        points: [
          { name: '目标客户画像', description: '定义理想客户的人口统计和心理特征' },
          { name: '消费者需求洞察', description: '挖掘客户的真实需求、痛点和购买动机' },
          { name: '购买决策流程', description: '了解客户从认知到购买的完整路径' },
          { name: '消费者调研方法', description: '问卷、访谈、焦点小组等调研技术' },
        ],
      },
    ],
  },

  // ===== 领域二：品牌策略 =====
  {
    name: '品牌策略',
    description: '建立品牌定位、视觉识别和品牌管理体系',
    topics: [
      {
        name: '品牌定位',
        description: '确定品牌的市场定位和核心价值',
        points: [
          { name: '品牌定位方法论', description: '差异化定位、品类定位、价值主张' },
          { name: '品牌命名', description: '命名原则、语言文化考量、商标可注册性' },
          { name: '品牌故事', description: '构建品牌起源故事和核心叙事' },
        ],
      },
      {
        name: '品牌识别',
        description: '设计品牌的视觉和语言体系',
        points: [
          { name: '视觉识别系统', description: 'Logo、色彩、字体、图形语言' },
          { name: '包装设计', description: '包装功能、材质选择、信息层级、开箱体验' },
          { name: '品牌调性与语言', description: '品牌说话的方式、文案风格' },
        ],
      },
      {
        name: '品牌管理',
        description: '维护品牌一致性和口碑',
        points: [
          { name: '品牌资产管理', description: '品牌一致性维护、品牌手册' },
          { name: '品牌口碑', description: '评价管理、口碑传播、危机应对' },
        ],
      },
    ],
  },

  // ===== 领域三：产品开发 =====
  {
    name: '产品开发',
    description: '从产品设计到测试到迭代的完整流程',
    topics: [
      {
        name: '产品设计',
        description: '将需求转化为具体产品',
        points: [
          { name: '产品需求定义', description: '从用户需求转化为产品功能规格' },
          { name: '材料与工艺选择', description: '面料、辅料、生产工艺的选择与评估' },
          { name: '尺码体系', description: '目标市场的尺码标准（EU尺码）、尺码表设计' },
          { name: '产品打样', description: '从设计稿到样品的流程、打样沟通要点' },
        ],
      },
      {
        name: '产品测试',
        description: '验证产品质量和用户体验',
        points: [
          { name: '功能测试', description: '产品性能测试标准和方法' },
          { name: '用户测试', description: '小范围试穿、反馈收集、迭代改进' },
          { name: '合规检测', description: '产品认证和检测报告获取' },
        ],
      },
      {
        name: '产品迭代',
        description: '基于数据和反馈持续改进产品',
        points: [
          { name: '产品线规划', description: 'SKU 策略、产品矩阵、上新节奏' },
          { name: '基于反馈的改进', description: '从销售数据和用户反馈驱动产品优化' },
        ],
      },
    ],
  },

  // ===== 领域四：供应链 =====
  {
    name: '供应链',
    description: '管理供应商、生产和库存的完整链路',
    topics: [
      {
        name: '供应商管理',
        description: '寻找、评估和维护供应商关系',
        points: [
          { name: '寻找工厂', description: '渠道、方法、评估标准' },
          { name: '验厂与评估', description: '工厂实地考察、产能评估、合规审查' },
          { name: '供应商谈判', description: '价格谈判、账期、MOQ、合同要点' },
          { name: '供应商关系维护', description: '长期合作策略、备选供应商管理' },
        ],
      },
      {
        name: '生产管理',
        description: '控制生产过程的质量和成本',
        points: [
          { name: '生产排期', description: '下单到交货的时间管理' },
          { name: '质量控制', description: 'QC 标准制定、验货流程（产前/产中/产后）' },
          { name: '成本控制', description: 'BOM 成本分析、降本策略' },
        ],
      },
      {
        name: '库存管理',
        description: '优化库存和仓储方案',
        points: [
          { name: '库存策略', description: '安全库存、补货周期、库存周转' },
          { name: '仓储方案', description: '自建仓 vs 第三方仓、海外仓选择' },
        ],
      },
    ],
  },

  // ===== 领域五：进出口与物流 =====
  {
    name: '进出口与物流',
    description: '掌握国际贸易流程和物流方案',
    topics: [
      {
        name: '国际贸易基础',
        description: '了解贸易术语和进出口流程',
        points: [
          { name: '贸易术语', description: 'FOB、CIF、DDP 等 Incoterms 详解' },
          { name: '出口流程', description: '中国出口报关、报检、退税' },
          { name: '进口流程', description: '法国/EU 进口清关、关税计算' },
        ],
      },
      {
        name: '物流方案',
        description: '选择合适的运输和配送方式',
        points: [
          { name: '国际运输方式', description: '海运、空运、铁路、快递的对比和选择' },
          { name: '物流服务商', description: '货代选择、物流报价对比、时效管理' },
          { name: '最后一公里', description: '法国本地配送方案' },
        ],
      },
      {
        name: '关税与税务',
        description: '处理关税、增值税和贸易政策',
        points: [
          { name: '关税与 HS 编码', description: '纺织品的关税税率、产品归类' },
          { name: '增值税 (TVA)', description: '法国 VAT 注册、申报、缴纳' },
          { name: '双边贸易政策', description: '中法/中欧贸易协定相关优惠' },
        ],
      },
    ],
  },

  // ===== 领域六：法律合规 =====
  {
    name: '法律合规',
    description: '确保公司运营和产品符合法规要求',
    topics: [
      {
        name: '公司注册',
        description: '在法国设立公司的流程',
        points: [
          { name: '法国公司类型', description: 'SARL、SAS、auto-entrepreneur 等对比' },
          { name: '注册流程', description: '在法国注册公司的步骤和所需材料' },
          { name: '银行账户与财务设置', description: '商业银行开户、会计要求' },
        ],
      },
      {
        name: '产品合规',
        description: '满足 EU 产品法规和标准',
        points: [
          { name: 'EU 纺织品法规', description: '纤维成分标签、REACH 法规、CE 标志' },
          { name: '产品安全标准', description: '适用的 EN 标准、测试认证' },
          { name: '标签要求', description: '法语标签内容、洗涤标识、产地标注' },
          { name: '功能性产品声明', description: '健康相关产品的宣传用语合规' },
        ],
      },
      {
        name: '知识产权',
        description: '保护品牌和产品的知识产权',
        points: [
          { name: '商标注册', description: '法国/EU 商标注册流程（INPI/EUIPO）' },
          { name: '外观设计保护', description: '产品外观专利' },
          { name: '品牌保护策略', description: '防止侵权、监控市场' },
        ],
      },
      {
        name: '消费者保护',
        description: '遵守消费者权益保护法规',
        points: [
          { name: '退换货政策', description: '法国消费者保护法（14天冷静期等）' },
          { name: '隐私与数据保护', description: 'GDPR 合规要求' },
          { name: '电商法律要求', description: '在线销售的法定信息公示义务' },
        ],
      },
    ],
  },

  // ===== 领域七：销售渠道 =====
  {
    name: '销售渠道',
    description: '建立线上线下销售网络',
    topics: [
      {
        name: '线上渠道',
        description: '搭建电商销售平台',
        points: [
          { name: '独立站搭建', description: 'Shopify/WooCommerce 选择和搭建' },
          { name: '电商平台入驻', description: 'Amazon.fr、Cdiscount、其他法国平台' },
          { name: '平台运营', description: 'Listing 优化、评价管理、广告投放' },
        ],
      },
      {
        name: '线下渠道',
        description: '开拓实体销售渠道',
        points: [
          { name: '药房/医疗用品店', description: '健康产品的线下分销渠道' },
          { name: '批发与分销', description: '寻找分销商、建立分销网络' },
          { name: '展会与行业活动', description: '参加展会的准备和跟进' },
        ],
      },
      {
        name: '渠道策略',
        description: '制定多渠道销售策略',
        points: [
          { name: '渠道选择与优先级', description: '初创阶段的渠道聚焦策略' },
          { name: '定价与渠道协调', description: '不同渠道的定价策略和冲突管理' },
          { name: '全渠道体验', description: '线上线下一致的品牌体验' },
        ],
      },
    ],
  },

  // ===== 领域八：营销推广 =====
  {
    name: '营销推广',
    description: '获取客户并建立营销体系',
    topics: [
      {
        name: '数字营销',
        description: '利用数字渠道进行推广',
        points: [
          { name: '社交媒体营销', description: 'Facebook、Instagram、TikTok 在法国的运营' },
          { name: '搜索引擎优化 (SEO)', description: '法语 SEO、Google.fr 优化' },
          { name: '付费广告', description: 'Google Ads、Meta Ads 投放策略' },
          { name: '邮件营销', description: '邮件列表建设、自动化营销序列' },
        ],
      },
      {
        name: '内容营销',
        description: '通过优质内容吸引和转化客户',
        points: [
          { name: '内容策略', description: '内容规划、内容日历、内容类型选择' },
          { name: '健康教育内容', description: '通过科普内容建立专业信任' },
          { name: 'KOL/KOC 合作', description: '法国本地博主合作、佣金模式' },
        ],
      },
      {
        name: '品牌传播',
        description: '提升品牌知名度和影响力',
        points: [
          { name: '品牌上市策划', description: '新品牌发布的传播方案' },
          { name: '公关与媒体', description: '媒体关系、新闻稿、品牌曝光' },
          { name: '社区建设', description: '用户社群运营、品牌忠诚度' },
        ],
      },
    ],
  },

  // ===== 领域九：财务管理 =====
  {
    name: '财务管理',
    description: '管理资金、定价和日常财务',
    topics: [
      {
        name: '财务规划',
        description: '做好启动资金和商业计划',
        points: [
          { name: '启动资金估算', description: '从零到首单需要多少钱' },
          { name: '商业计划书', description: '财务预测、盈亏平衡分析' },
          { name: '融资方式', description: '自有资金、银行贷款、投资人、补贴' },
        ],
      },
      {
        name: '定价与利润',
        description: '制定合理的定价策略',
        points: [
          { name: '成本结构分析', description: '产品成本、物流成本、运营成本拆解' },
          { name: '定价策略', description: '成本加成、竞品参照、价值定价' },
          { name: '利润率管理', description: '毛利率、净利率的目标和优化' },
        ],
      },
      {
        name: '日常财务',
        description: '处理记账、现金流和税务',
        points: [
          { name: '记账与发票', description: '法国的会计准则和发票要求' },
          { name: '现金流管理', description: '现金流预测、账期管理' },
          { name: '税务申报', description: '企业所得税、TVA 申报周期和方法' },
        ],
      },
    ],
  },

  // ===== 领域十：客户运营 =====
  {
    name: '客户运营',
    description: '管理客户关系并驱动业务增长',
    topics: [
      {
        name: '客户服务',
        description: '建立售后服务体系',
        points: [
          { name: '售后服务体系', description: '客服渠道、响应标准、FAQ 建设' },
          { name: '退换货处理', description: '退货流程设计、逆向物流' },
          { name: '客户投诉处理', description: '投诉响应、危机升级、补偿策略' },
        ],
      },
      {
        name: '客户增长',
        description: '优化获客和客户价值',
        points: [
          { name: '客户获取成本 (CAC)', description: '各渠道获客成本计算和优化' },
          { name: '客户生命周期价值 (LTV)', description: '提升复购率和客单价' },
          { name: '忠诚度计划', description: '会员体系、复购激励' },
        ],
      },
      {
        name: '数据驱动运营',
        description: '用数据指导运营决策',
        points: [
          { name: '关键指标体系', description: '电商核心指标（转化率、客单价、复购率等）' },
          { name: '数据分析工具', description: 'Google Analytics、平台后台数据分析' },
          { name: 'A/B 测试', description: '产品页面、广告素材、定价的测试方法' },
        ],
      },
    ],
  },
];
