export type {
  GuideSectionLabels,
  SettingGuideEntry,
  SettingGuidesCatalog,
} from './types'
export { getSettingGuidesCatalog } from './catalog'
export {
  getTappPermissionGuide,
  getTappPermissionGuides,
  tappPermissionGuidePath,
} from './tappPermissionGuides'
export type { TappPermissionGuides } from './tappPermissionGuides'
export { SettingGuideBody } from './SettingGuideBody'
export { useSettingGuide } from './useSettingGuide'
export type { GuideBinding } from './useSettingGuide'
export {
  guideAnchorId,
  guideDomProps,
  findGuideElement,
  scrollToSettingGuide,
  scheduleScrollToSettingGuide,
  GUIDE_PATH_ATTR,
} from './guideAnchor'
export {
  buildGuideSearchIndex,
  guideKeywordsForSection,
  GUIDE_CATALOG_TO_SECTION,
  guideEntryTitle,
  tokenizeForSearch,
} from './guideSearchIndex'
export type { GuideSearchEntry } from './guideSearchIndex'
export {
  rankConfigSearch,
  parseSearchQuery,
  extractMatchSnippet,
  scoreSearchItem,
} from './configSearch'
export type {
  ConfigSearchableItem,
  RankedSearchItem,
} from './configSearch'
