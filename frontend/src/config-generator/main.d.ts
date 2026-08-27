/** src/config-generator/main.js 的类型声明(移植的 vanilla JS,不纳入 typecheck) */

/** 挂载生成器:在 page.html markup 注入容器后调用;locale 缺省沿用内置中文 */
export function mountConfigGenerator(locale?: string): void

/** 卸载生成器:解绑全部页面监听 */
export function unmountConfigGenerator(): void
