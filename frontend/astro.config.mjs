import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 读取 package.json 版本号
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
)
const APP_VERSION = pkg.version || '0.3.21'

/** 天气小组件需要文档级 geolocation 权限 */
const DOCUMENT_PERMISSIONS_POLICY =
  'geolocation=(self), microphone=(), camera=()'

/**
 * 开发/预览服务器安全响应头
 */
function permissionsPolicyPlugin() {
  const setHeader = (req, res, next) => {
    if (!res.getHeader('Permissions-Policy')) {
      res.setHeader('Permissions-Policy', DOCUMENT_PERMISSIONS_POLICY)
    }
    next()
  }
  return {
    name: 'permissions-policy',
    configureServer(server) {
      server.middlewares.use(setHeader)
    },
    configurePreviewServer(server) {
      server.middlewares.use(setHeader)
    },
  }
}

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // 纯静态单页官网：无后端、无动态路由
  output: 'static',
  server: {
    port: 1102,
    host: true,
  },
  build: {
    inlineStylesheets: 'auto',
    // 产出 dist/index.html(file 格式),配合任意静态服务器直接托管
    format: 'file',
  },
  // Astro 6: 内置 Fonts API - 自动下载并自托管 Google Fonts，优化性能和隐私
  // 所有字体均通过此 API 自托管，消除对 Google Fonts CDN 的运行时请求
  fonts: [
    // 主体字体
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      fallbacks: [
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'sans-serif',
      ],
    },
    // 标题装饰字体（由 useTitleFont hook 按需切换）
    // 每个字体只注册实际使用的字重（与 fonts.css .title-font-* 对齐），避免多余 face
    {
      provider: fontProviders.google(),
      name: 'Qwitcher Grypen',
      cssVariable: '--font-qwitcher-grypen',
      weights: [700],
      styles: ['normal'],
      fallbacks: ['cursive'],
    },
    {
      provider: fontProviders.google(),
      name: 'Codystar',
      cssVariable: '--font-codystar',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['system-ui'],
    },
    {
      provider: fontProviders.google(),
      name: 'Henny Penny',
      cssVariable: '--font-henny-penny',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['system-ui'],
    },
    {
      provider: fontProviders.google(),
      name: 'Srisakdi',
      cssVariable: '--font-srisakdi',
      weights: [700],
      styles: ['normal'],
      fallbacks: ['system-ui'],
    },
    {
      provider: fontProviders.google(),
      name: 'Fleur De Leah',
      cssVariable: '--font-fleur-de-leah',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['cursive'],
    },
    {
      provider: fontProviders.google(),
      name: 'League Script',
      cssVariable: '--font-league-script',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['cursive'],
    },
    {
      provider: fontProviders.google(),
      name: 'Megrim',
      cssVariable: '--font-megrim',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['system-ui'],
    },
    {
      provider: fontProviders.google(),
      name: 'Silkscreen',
      cssVariable: '--font-silkscreen',
      weights: [700],
      styles: ['normal'],
      fallbacks: ['system-ui'],
    },
    {
      provider: fontProviders.google(),
      name: 'UnifrakturMaguntia',
      cssVariable: '--font-unifraktur-maguntia',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Cinzel',
      cssVariable: '--font-cinzel',
      weights: [700],
      styles: ['normal'],
      fallbacks: ['serif'],
    },
  ],
  trailingSlash: 'never',
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    plugins: [
      tailwindcss(), // Tailwind CSS v4 Vite plugin
      permissionsPolicyPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@config': path.resolve(__dirname, './src/config.ts'),
      },
    },
    // Astro 6 / Vite 7: 客户端 Rollup 输出配置迁移到 environments.client
    environments: {
      client: {
        build: {
          rollupOptions: {
            output: {
              manualChunks: (id) => {
                // React 核心合并到同一 chunk
                // jsx-runtime 的模块 id 可能不带 node_modules/react/ 前缀
                // （pnpm 布局 / 虚拟模块）。不显式归类的话，Rolldown 会把它
                // 塞进任意 chunk（实测进了 motion），导致所有 JSX chunk
                // 为了 1KB 的 jsx-runtime 静态依赖整个 124K motion chunk
                if (
                  id.includes('node_modules/react/') ||
                  id.includes('node_modules/react-dom/') ||
                  id.includes('jsx-runtime')
                ) {
                  return 'react-vendor'
                }
                // Motion — 注意 motion-dom / motion-utils 是独立包，
                // 路径同样含 node_modules/motion，若并入同一 chunk，
                // 其中被共享的小工具会让整个 124K chunk 变成静态依赖，
                // 破坏 lazyMotion 的动态加载设计
                if (id.includes('node_modules/motion-utils')) {
                  return 'motion-utils'
                }
                if (id.includes('node_modules/motion-dom')) {
                  return 'motion-dom'
                }
                if (id.includes('node_modules/motion')) {
                  return 'motion'
                }
                // react-icons 各子包分开打包（仅动态导入时使用）
                if (id.includes('node_modules/react-icons/fa6/')) {
                  return 'icons-fa6'
                }
                if (id.includes('node_modules/react-icons/fa/')) {
                  return 'icons-fa'
                }
                if (id.includes('node_modules/react-icons/si/')) {
                  return 'icons-si'
                }
                if (id.includes('node_modules/react-icons')) {
                  return 'icons-base'
                }
              },
              // 优化文件名用于长期缓存
              chunkFileNames: 'assets/[name]-[hash].js',
              entryFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash].[ext]',
            },
          },
        },
      },
    },
    build: {
      cssCodeSplit: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          // eslint-disable-next-line node/prefer-global/process
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: true,
          passes: 2,
        },
        mangle: {
          safari10: true,
        },
      },
      assetsInlineLimit: 4096,
      // 启用 gzip 和 brotli 压缩报告
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
    },
  },
})
