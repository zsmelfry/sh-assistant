// Workaround for Nuxt 3.21 SPA manifest bug:
// In SPA mode (ssr: false), the production client manifest gets overwritten with
// dev-mode entries between the Vite build and Nitro build during build:done.
// This causes production HTML to reference @vite/client instead of hashed chunks.
// Fix: capture the correct manifest in build:manifest, inject it as Nitro virtual
// modules in nitro:build:before so the Nitro build uses the correct data.
let _savedManifest: string | null = null;
let _savedPrecomputed: string | null = null;

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

  hooks: {
    'build:manifest'(manifest) {
      try {
        const { precomputeDependencies } = require('vue-bundle-renderer');
        const { serialize } = require('seroval');
        _savedManifest = 'export default ' + serialize(manifest);
        _savedPrecomputed = 'export default ' + serialize(precomputeDependencies(manifest));
      } catch {
        // Dev mode — modules may not be available
      }
    },
    'nitro:build:before'(nitro: any) {
      if (_savedManifest && _savedPrecomputed) {
        nitro.options.virtual['#build/dist/server/client.manifest.mjs'] = _savedManifest;
        nitro.options.virtual['#build/dist/server/client.precomputed.mjs'] = _savedPrecomputed;
      }
    },
  },
});
