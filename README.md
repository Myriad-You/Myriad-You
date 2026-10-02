# Myriad 官网(myriad-you)

Myriad 的官方静态网站 —— 单页、纯静态、零后端依赖。

`frontend/` 源自 Myriad 主仓库前端，**完整保留了 Myriad 首页的视觉与交互**(花体 "Dashboard" 大标题、用户信息玻璃卡、welcome/weather/quote 活体小组件网格、壁纸取色联动、右上角控制栏、明暗主题),剥离了全部后端耦合:

- 无业务路由、无登录、无 Myriad 后端依赖;其他页面(Library / Brew / Reports / Config / Tapp 等)已全部移除。
- 壁纸与板块结构位于 `frontend/src/content/site.ts`；站点文案来自 `frontend/src/i18n/` 的三语言配置。
- 网格中的官网板块卡(核心特性 / 界面预览 / 下载安装 / 技术栈 / 关于)与 welcome 小组件的引导卡，点击均弹出详情弹窗。
- 「安装部署教程」板块卡和 welcome 引导卡提供从服务器准备、配置生成、首次初始化到 HTTPS、旧站升级和整站备份的教程，支持中文、英文和日文。
- 「Myriad 安装部署器」通过轻量独立运行时加载官方 [com.myriad.config-generator](https://github.com/Myriad-You/tapp-store/tree/main/apps/com.myriad.config-generator)。每次打开先读取 `tapp-store/main` 的提交 SHA，再从同一提交下载目录、manifest、页面、样式、模块与词典。官网不再运行内置的生成器副本；上游保持接口兼容时，无需更新或重新发布官网就能使用新版。
- 远端应用只在没有同源权限的 sandbox iframe 内运行。宿主提供 CommonJS、语言与主题、通知、浏览器文件下载及固定的公共版本查询接口，应用无法读写官网 DOM、cookie 或存储。语言和主题变化不重建正在填写的表单。GitHub 不可达、资源不一致或新增未支持的能力时会显示重试与官方说明入口。
- 加载部署器需要访问 GitHub；镜像版本查询会使用 Docker Hub 和 GitHub Release。网络受限时可按官方说明手动填写已发布的版本。配置包含凭据，请保存在可信设备上，不要公开分享。
- 天气(open-meteo)与一言(hitokoto)小组件直连公共 API,无需任何服务端。

## 本地运行

```bash
cd frontend
pnpm install
pnpm dev
```

构建静态产物:

```bash
cd frontend
pnpm build   # 输出到 frontend/dist/,任意静态服务器均可托管
```

## 常用检查

```bash
cd frontend
pnpm typecheck    # astro check
pnpm lint         # ESLint
pnpm stylelint    # Stylelint
pnpm test:generator-runtime # 验证远端包加载与隔离边界
```

## 修改站点内容

板块结构与壁纸配置位于 `frontend/src/content/site.ts`，文案在 `frontend/src/i18n/`。安装教程正文在 `frontend/src/i18n/deployment/`，共享命令、官方链接与核对版本在 `frontend/src/content/deployment.ts`；壁纸与头像等静态资源位于 `frontend/public/`。

教程按 2026-10-01 的 [Myriad v0.6.1](https://github.com/Myriad-You/Myriad/releases/tag/v0.6.1) 与部署器 1.0.6 核对。后续更新时须同时检查主仓库的 `docker-compose.yml`、`scripts/extra/deploy.sh`、`docs/deployment/DATA_LAYOUT.md`、`SETUP_BOOTSTRAP.md`、`BACKUP.md` 和部署器实际输出。主仓库个别旧说明可能滞后，尤其是目录挂载、worker、端口、修改环境变量后的重建和备份范围。

独立运行时在 `frontend/src/services/remoteGenerator.ts`、`frontend/src/tapp-runtime/bootstrap.ts` 与 `frontend/src/components/ConfigGeneratorModal.tsx`。教程保留明确的核对版本；部署器版本与提交号则以打开时实际加载的远端包为准。上游新增宿主 API 或更改模块协议时，仍需更新这层运行时适配。
