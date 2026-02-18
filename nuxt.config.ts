export default defineNuxtConfig({
  // SPA 模式（个人工具无 SEO 需求）
  ssr: false,

  // 全局 CSS
  css: ['~/assets/css/variables.css'],

  // Pinia 模块
  modules: ['@pinia/nuxt'],

  // TypeScript 严格模式
  typescript: {
    strict: true,
  },

  // 开发工具
  devtools: { enabled: true },

  // 路由配置
  routeRules: {
    '/': { redirect: '/habit-tracker' },
  },

  compatibilityDate: '2025-01-01',
});
