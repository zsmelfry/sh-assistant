import { eq } from 'drizzle-orm';
import { smProducts } from '~/server/database/schema';
import { SEED_DOMAINS, SEED_STAGES } from '~/server/database/seeds/startup-map';
import { registerSkill } from '../registry';
import type { SkillTeachingContext } from '../types';
import type { ChatMessage } from '~/server/lib/llm/types';

function buildProductContext(product: any): string {
  if (!product) return '';
  return `
当前学习者的产品背景：
- 产品名称：${product.name}
${product.description ? `- 产品描述：${product.description}` : ''}
${product.targetMarket ? `- 目标市场：${product.targetMarket}` : ''}
${product.targetCustomer ? `- 目标客户：${product.targetCustomer}` : ''}
${product.productionSource ? `- 生产来源：${product.productionSource}` : ''}
${product.currentStage ? `- 当前阶段：${product.currentStage}` : ''}
${product.notes ? `- 补充信息：${product.notes}` : ''}`;
}

registerSkill({
  id: 'startup-map',
  name: '创业地图',

  buildTeachingPrompt(ctx: SkillTeachingContext): ChatMessage[] {
    const product = ctx.extra?.product;
    const productContext = buildProductContext(product);

    return [
      {
        role: 'system',
        content: `你是一位资深的创业导师和商业教育专家。你正在为一个创业学习平台生成教学内容。
${productContext}

你需要为以下知识点生成教学内容：
- 所属领域：${ctx.domain.name}
- 所属主题：${ctx.topic.name}
- 知识点：${ctx.point.name}
${ctx.point.description ? `- 简介：${ctx.point.description}` : ''}

请按以下 5 个板块生成内容，每个板块使用 Markdown 格式。板块之间必须用 "---SECTION_BREAK---" 分隔（单独一行）：

1. **是什么 (What)** — 概念定义，重要性，在创业流程中的位置
2. **怎么做 (How)** — 通用方法论、执行步骤、常用框架和工具
3. **案例 (Example)** — 1-2 个真实品牌案例，展示知识如何在实际商业中被运用
4. **我的应用 (Apply)** — ${product ? '结合学习者的产品，' : ''}提出 2-3 个引导思考问题
5. **推荐资源 (Resources)** — 推荐书籍、网站、工具、课程

要求：
- 前 3 个板块是通用方法论（不绑定具体产品）
- 第 4 个板块针对${product ? '学习者的具体产品' : '一般创业场景'}
- 内容深入实用，不要泛泛而谈
- 每个板块 300-800 字
- 直接输出内容，不要重复板块标题`,
      },
      {
        role: 'user',
        content: `请为"${ctx.point.name}"生成教学内容。`,
      },
    ];
  },

  buildChatSystemMessage(ctx: SkillTeachingContext & { teachingSummary: string }): ChatMessage {
    const product = ctx.extra?.product;
    let productContext = '';
    if (product) {
      productContext = `\n\n用户的产品背景：
- 产品：${product.name}${product.description ? ` — ${product.description}` : ''}
${product.targetMarket ? `- 目标市场：${product.targetMarket}` : ''}
${product.targetCustomer ? `- 目标客户：${product.targetCustomer}` : ''}`;
    }

    return {
      role: 'system',
      content: `你是一位经验丰富的创业导师。用户正在学习以下创业知识点，请帮助用户深入理解并应用到实际场景中。

知识点信息：
- 领域：${ctx.domain.name}
- 主题：${ctx.topic.name}
- 知识点：${ctx.point.name}${ctx.point.description ? ` — ${ctx.point.description}` : ''}
${ctx.teachingSummary ? `\n该知识点的教学内容摘要：\n${ctx.teachingSummary}` : ''}${productContext}

你的角色：
1. 回答用户关于该知识点的疑问
2. 针对用户的产品场景提出思考问题
3. 纠正可能的误解
4. 建议下一步行动
5. 在合适时推荐相关的其他知识点`,
    };
  },

  buildTaskPrompt(ctx: SkillTeachingContext): ChatMessage[] {
    const product = ctx.extra?.product;
    let productContext = '';
    if (product) {
      productContext = `
学习者的产品背景：
- 产品名称：${product.name}
${product.description ? `- 产品描述：${product.description}` : ''}
${product.targetMarket ? `- 目标市场：${product.targetMarket}` : ''}
${product.targetCustomer ? `- 目标客户：${product.targetCustomer}` : ''}`;
    }

    return [
      {
        role: 'system',
        content: `你是一位资深的创业导师。你需要为创业学习平台的知识点生成实践任务。
${productContext}

知识点信息：
- 所属领域：${ctx.domain.name}
- 所属主题：${ctx.topic.name}
- 知识点：${ctx.point.name}
${ctx.point.description ? `- 简介：${ctx.point.description}` : ''}

请生成 2-3 个实践任务，每个任务帮助学习者将这个知识点应用到${product ? '自己的产品' : '实际创业场景'}中。

严格按以下 JSON 格式输出（不要添加任何其他文字）：
[
  {
    "description": "任务描述（1-2句话，说明要做什么）",
    "expectedOutput": "预期产出（具体要交付什么）",
    "hint": "参考提示（帮助完成任务的建议）"
  }
]

要求：
- 任务要具体可执行，不要太抽象
- 预期产出要明确可衡量
- 参考提示要实用`,
      },
      {
        role: 'user',
        content: `请为"${ctx.point.name}"生成实践任务。`,
      },
    ];
  },

  teachingSections: [
    { key: 'what', label: '是什么' },
    { key: 'how', label: '怎么做' },
    { key: 'example', label: '案例' },
    { key: 'apply', label: '我的应用' },
    { key: 'resources', label: '推荐资源' },
  ],

  statusLabels: {
    not_started: '未开始',
    learning: '学习中',
    understood: '已理解',
    practiced: '已实践',
  },

  activityTypeLabels: {
    view: '查看知识点',
    chat: 'AI 对话',
    note: '编辑笔记',
    task: '完成任务',
    status_change: '状态变更',
  },

  async resolveExtraContext(db, _ctx) {
    const [product] = await db.select().from(smProducts).where(eq(smProducts.isActive, true)).limit(1);
    return product ? { product } : {};
  },

  seedData: { domains: SEED_DOMAINS, stages: SEED_STAGES },
});

// Export a token so Vite/Nitro doesn't tree-shake this module as side-effect-only
export const STARTUP_MAP_SKILL_ID = 'startup-map' as const;
