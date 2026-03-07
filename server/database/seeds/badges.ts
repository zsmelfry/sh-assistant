export const BADGE_SEED = [
  // Cross-skill general
  { key: 'first_milestone', name: '第一步', description: '完成第一个里程碑', rarity: 'common' },
  { key: 'first_tier', name: '入门者', description: '任意技能达到入门段位', rarity: 'common' },
  { key: 'triple_focus', name: '三线作战', description: '同时拥有3个焦点计划', rarity: 'common' },
  { key: 'polymath', name: '博学者', description: '在5个以上大类中各有至少1个技能达到基础段位', rarity: 'rare' },
  { key: 'deep_mastery', name: '精深者', description: '任意技能达到卓越段位', rarity: 'legendary' },

  // Self management
  { key: 'streak_30', name: '30天坚持', description: '任意习惯连续打卡30天', rarity: 'common' },
  { key: 'streak_100', name: '百日不辍', description: '任意习惯连续打卡100天', rarity: 'rare' },
  { key: 'streak_365', name: '年度坚持者', description: '任意习惯连续打卡365天', rarity: 'epic' },
  { key: 'goal_crusher', name: '目标粉碎机', description: '年度计划完成率超过80%', rarity: 'rare' },

  // Language
  { key: 'vocab_1k', name: '千词斩', description: '任意语言词汇量突破1000', rarity: 'common' },
  { key: 'vocab_10k', name: '万词王', description: '任意语言词汇量突破10000', rarity: 'epic' },

  // Sports
  { key: 'marathon', name: '全马完赛者', description: '完成42公里马拉松', rarity: 'epic' },
  { key: 'half_marathon', name: '半马完赛者', description: '完成21公里半马', rarity: 'rare' },

  // Learning
  { key: 'lifelong_learner', name: '终身学习者', description: '同时在学3个以上技能', rarity: 'common' },
  { key: 'skill_complete', name: '知识工匠', description: '某技能学习模块全部知识点达到practiced', rarity: 'rare' },
] as const;
