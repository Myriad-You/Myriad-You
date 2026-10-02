/** Installation facts checked against Myriad v0.6.1 and the Tapp generator. */
export const deploymentReference = {
  verifiedAt: '2026-10-01',
  myriadVersion: 'v0.6.1',
  generatorVersion: '1.0.6',
} as const

const repository = 'https://github.com/Myriad-You/Myriad'
const deploymentDocs = `${repository}/blob/${deploymentReference.myriadVersion}/docs/deployment`

export const deploymentLinks = {
  releases: `${repository}/releases`,
  generator:
    'https://github.com/Myriad-You/tapp-store/tree/main/apps/com.myriad.config-generator',
  quickstart: `${repository}/blob/${deploymentReference.myriadVersion}/docs/QUICKSTART.md`,
  docker: `${deploymentDocs}/DOCKER_DEPLOYMENT.md`,
  storage: `${deploymentDocs}/DATA_LAYOUT.md`,
  setup: `${deploymentDocs}/SETUP_BOOTSTRAP.md`,
  updater: `${deploymentDocs}/UPDATER_QUICKSTART.md`,
  backup: `${deploymentDocs}/BACKUP.md`,
  externalDatabase: `${deploymentDocs}/EXTERNAL_POSTGRES.md`,
  ports: `${deploymentDocs}/PORTS.md`,
} as const

/** Shared commands keep the three translations on the same deployment path. */
export const deploymentCommands = {
  prerequisites: 'docker --version\ndocker compose version\njq --version',
  manualPrepare: `git clone --branch ${deploymentReference.myriadVersion} --depth 1 https://github.com/Myriad-You/Myriad.git\ncd Myriad\ncp .env.production.example .env`,
  manualStart: 'bash scripts/extra/deploy.sh up',
  status: 'docker compose ps\ndocker compose logs --tail=100 backend federation-worker persona-worker',
  backup: 'bash scripts/extra/backup.sh backup',
} as const

export interface DeploymentGuideLink {
  label: string
  href: string
}

export interface DeploymentGuideSection {
  id: string
  title: string
  paragraphs?: string[]
  list?: string[]
  commands?: { label: string; code: string }[]
  note?: string
  links?: DeploymentGuideLink[]
}

export interface DeploymentGuideContent {
  intro: string
  verifiedLabel: string
  openGenerator: string
  contentsLabel: string
  resourcesLabel: string
  sections: DeploymentGuideSection[]
  resources: DeploymentGuideLink[]
}
