# myriad-you

Myriad 官网前端项目。

`frontend/` 是从主仓库 `Myriad/frontend/` 一比一复制的原始前端，首页实现、组件、样式、静态资源与构建配置均保持不变。仓库不包含 Rust 后端、数据库、反向代理或更新器代码。

`shared/image_proxy_hosts.json` 是原前端构建时直接引用的共享静态配置，保留原仓库相对路径以避免修改前端源码。

## 本地运行

```bash
cd frontend
pnpm install
pnpm dev --host 127.0.0.1 --port 4321
```

未连接 Myriad 后端时，首页会按照原始前端自己的失败回退行为运行；本项目没有伪造或重写首页组件。
