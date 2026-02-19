export default defineNuxtConfig({
  // SPA 模式（个人工具无 SEO 需求）
  ssr: false,

  // 监听所有网卡，允许局域网设备访问
  devServer: { host: '0.0.0.0' },

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1',
    },
  },

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

  compatibilityDate: '2025-01-01',
});
