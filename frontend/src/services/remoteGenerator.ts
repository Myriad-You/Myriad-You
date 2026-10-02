/** Fetch the official generator as one immutable GitHub snapshot. */
const repository = 'Myriad-You/tapp-store'
const applicationId = 'com.myriad.config-generator'
const packageRoot = `apps/${applicationId}/`
const supportedPermissions = new Set([
  'storage:read', 'ui:notification', 'ui:theme', 'ui:confirm', 'network:fetch',
])

export interface RemoteGeneratorBundle {
  version: string
  revision: string
  entry: string
  template: string
  styles: string
  modules: Record<string, string>
  translations: Record<string, Record<string, string>>
}

export const remoteGeneratorSource =
  `https://github.com/${repository}/tree/main/${packageRoot.slice(0, -1)}`

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid generator metadata')
  }
  return value as Record<string, unknown>
}

function packagePath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith(packageRoot)) {
    throw new Error('Generator file outside its package')
  }
  const relative = value.slice(packageRoot.length)
  if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..') ||
    !/^[\w./-]+$/.test(relative)) {
    throw new Error('Invalid generator file path')
  }
  return relative
}

async function fetchText(url: string, signal: AbortSignal, limit = 2 * 1024 * 1024) {
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-cache',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  })
  if (!response.ok) throw new Error('Official generator request failed')
  const content = await response.text()
  if (content.length > limit) throw new Error('Generator resource is too large')
  return content
}

export async function loadRemoteGenerator(signal: AbortSignal): Promise<RemoteGeneratorBundle> {
  const commit = object(JSON.parse(await fetchText(
    `https://api.github.com/repos/${repository}/commits/main`, signal,
  )))
  const revision = commit.sha
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error('Invalid generator revision')
  }
  const base = `https://raw.githubusercontent.com/${repository}/${revision}/`
  const [indexText, manifestText] = await Promise.all([
    fetchText(`${base}index.json`, signal, 8 * 1024 * 1024),
    fetchText(`${base}${packageRoot}manifest.json`, signal),
  ])
  const index = object(JSON.parse(indexText))
  const manifest = object(JSON.parse(manifestText))
  const apps = index.apps
  if (!Array.isArray(apps)) throw new Error('Invalid official store index')
  const app = object(apps.find(value => object(value).id === applicationId))
  if (manifest.id !== applicationId || manifest.version !== app.version ||
    typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version)) {
    throw new Error('Generator manifest and catalog disagree')
  }
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some(
    permission => typeof permission !== 'string' || !supportedPermissions.has(permission),
  )) {
    throw new Error('Generator requires an unsupported runtime capability')
  }
  const download = object(app.download)
  const core = object(manifest.core)
  const page = object(manifest.page)
  const entry = packagePath(download.code)
  if (entry !== core.entry || packagePath(download.page_template) !== page.template ||
    packagePath(download.page_styles) !== page.styles) {
    throw new Error('Generator entry points disagree')
  }
  const modulePaths = Object.entries(object(download.modules))
  if (modulePaths.length > 32 || modulePaths.some(([name, path]) => (
    name !== packagePath(path) || !name.endsWith('.js') || name === entry
  ))) {
    throw new Error('Invalid generator modules')
  }
  const localePaths = object(download.i18n)
  const locales = ['zh-CN', 'en-US', 'ja-JP']
  for (const locale of locales) packagePath(localePaths[locale])
  const [template, styles, modules, dictionaries] = await Promise.all([
    fetchText(`${base}${download.page_template}`, signal),
    fetchText(`${base}${download.page_styles}`, signal),
    Promise.all([[entry, download.code], ...modulePaths].map(async ([name, path]) => (
      [name, await fetchText(`${base}${path}`, signal)] as const
    ))),
    Promise.all(locales.map(async locale => {
      const dictionary = object(JSON.parse(await fetchText(`${base}${localePaths[locale]}`, signal)))
      if (Object.values(dictionary).some(value => typeof value !== 'string')) {
        throw new Error('Invalid generator translation')
      }
      return [locale, dictionary as Record<string, string>] as const
    })),
  ])
  if ([template, styles, ...modules.map(([, source]) => source)].reduce(
    (total, source) => total + source.length, 0,
  ) > 5 * 1024 * 1024) {
    throw new Error('Generator package is too large')
  }
  return {
    revision,
    version: manifest.version,
    entry,
    template,
    styles,
    modules: Object.fromEntries(modules),
    translations: Object.fromEntries(dictionaries),
  }
}
