/// <reference path="../.astro/types.d.ts" />

// 全局常量（由 Vite define 注入）
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
