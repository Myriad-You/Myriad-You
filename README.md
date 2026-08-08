# Myriad 官网(myriad-you)

Myriad 的官方静态网站 —— 单页、纯静态、零后端依赖。

`frontend/` 源自 Myriad 主仓库前端，**完整保留了 Myriad 首页的视觉与交互**(花体 "Dashboard" 大标题、用户信息玻璃卡、welcome/weather/quote 活体小组件网格、壁纸取色联动、右上角控制栏、明暗主题),剥离了全部后端耦合:

- 无路由、无登录、无 API 请求;其他页面(Library / Brew / Reports / Config / Tapp 等)已全部移除。
- 壁纸、站点文案、板块内容均为本地静态配置，唯一内容真相源是 `frontend/src/content/site.ts`。
- 网格中的官网板块卡(核心特性 / 界面预览 / 下载安装 / 技术栈 / 关于)与 welcome 小组件的引导卡，点击均弹出详情弹窗。
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
```

## 修改站点内容

文案、壁纸、板块详情都集中在 `frontend/src/content/site.ts`;壁纸与头像等静态资源位于 `frontend/public/`。
