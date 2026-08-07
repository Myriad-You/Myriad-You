/**
 * 设置组件统一导出
 */

export { AutoHeight } from './AutoHeight'
export type { AutoHeightProps } from './AutoHeight'
export { CollapseRegion } from './CollapseRegion'
export type { CollapseRegionProps } from './CollapseRegion'
export { CompactSettingGroup } from './CompactSettingGroup'
export { InfoCard } from './InfoCard'
export { InfoActionCard } from './InfoActionCard'
export type {
  InfoActionButton,
  InfoActionCardProps,
  InfoActionCardTone,
  InfoActionField,
} from './InfoActionCard'
export { ManagedList } from './ManagedList'
export type {
  ManagedListAction,
  ManagedListButtonVariant,
  ManagedListFilterOption,
  ManagedListFilters,
  ManagedListItem,
  ManagedListProps,
  ManagedListSearch,
  ManagedListStat,
  ManagedListStatMetric,
  ManagedListStatSwitch,
  ManagedListTone,
} from './ManagedList'
// 动效系统（CSS 令牌在 settings-motion.css，JS 取值在 motion.ts）
export {
  prefersReducedMotion,
  SETTINGS_DURATION,
  SETTINGS_DURATION_MS,
  SETTINGS_EASE,
  SETTINGS_PAGE_MOTION,
  SETTINGS_SIDEBAR_MOTION,
} from './motion'
export { SectionSwitch } from './SectionSwitch'
export type {
  SectionSwitchDirection,
  SectionSwitchProps,
} from './SectionSwitch'
export { CheckboxCard } from './items/CheckboxCard'
export type {
  CheckboxCardProps,
  CheckboxCardSize,
  CheckboxCardTone,
  CheckboxCardVariant,
} from './items/CheckboxCard'
export { ButtonItem } from './items/ButtonItem'
export { SegmentedControl } from './items/ChoiceControls'
export type {
  ChoiceControlSize,
  ChoiceOption,
  SegmentedControlProps,
} from './items/ChoiceControls'
export { SettingsButton } from './items/SettingsButton'
export type {
  SettingsButtonProps,
  SettingsButtonSize,
  SettingsButtonVariant,
} from './items/SettingsButton'
export { CheckboxGroupItem } from './items/CheckboxGroupItem'
export { CheckboxItem } from './items/CheckboxItem'
export { FieldSelect } from './items/FieldSelect'
export { InputItem } from './items/InputItem'

export { NumberGroupItem } from './items/NumberGroupItem'
export { NumberItem } from './items/NumberItem'
export { ProviderItem } from './items/ProviderItem'
export { SelectItem } from './items/SelectItem'
export { SliderItem } from './items/SliderItem'
// 具体设置项组件
export { SwitchItem } from './items/SwitchItem'
export { ToggleSwitch } from './items/ToggleSwitch'
// 预设组合组件
export { PermissionGroup, QuotaGroup } from './presets'
export { SettingGroup } from './SettingGroup'
export type { SettingGroupProps } from './SettingGroup'
export {
  SettingsTocProvider,
  useSettingsToc,
  slugifySettingGroupId,
} from './SettingsTocContext'
export type { SettingsTocItem } from './SettingsTocContext'
export { SettingGroupGrid, useSettingGroupGrid } from './SettingGroupGrid'
export type {
  SettingGroupGridAlign,
  SettingGroupGridColumns,
  SettingGroupGridProps,
  SettingGroupGridVariant,
} from './SettingGroupGrid'
export { SettingTitleTag } from './SettingTitleTag'
export type {
  SettingTitleTagProps,
  SettingTitleTagVariant,
} from './SettingTitleTag'
export { SettingTitleSelect } from './SettingTitleSelect'
export type { SettingTitleSelectProps } from './SettingTitleSelect'
export { DateRangePopover } from './DateRangePopover'
export type {
  DateRangePopoverLabels,
  DateRangePopoverProps,
} from './DateRangePopover'
export { SettingFieldErrorTag } from './SettingFieldErrorTag'
export type { SettingFieldErrorTagProps } from './SettingFieldErrorTag'
export { SettingDefaultChangeTag } from './SettingDefaultChangeTag'
export type { SettingDefaultChangeTagProps } from './SettingDefaultChangeTag'
export {
  SETTING_PRODUCT_DEFAULTS,
  dismissSettingDefaultChange,
  getSettingDefaultChangeNotice,
  resetSettingDefaultChangeNoticesForTests,
} from './settingDefaultChanges'
export type { SettingDefaultChangeNotice } from './settingDefaultChanges'
export { SettingTitleHelp } from './SettingTitleHelp'
export type {
  SettingTitleHelpProps,
  SettingTitleHelpTone,
} from './SettingTitleHelp'
export { SettingTitleGuideEntry } from './SettingTitleGuideEntry'
export type { SettingTitleGuideEntryProps } from './SettingTitleGuideEntry'
export {
  getSettingGuidesCatalog,
  getTappPermissionGuide,
  getTappPermissionGuides,
  SettingGuideBody,
  useSettingGuide,
  guideAnchorId,
  guideDomProps,
  scrollToSettingGuide,
  scheduleScrollToSettingGuide,
  tappPermissionGuidePath,
} from './guides'
export type {
  GuideSectionLabels,
  SettingGuideEntry,
  SettingGuidesCatalog,
  GuideBinding,
  TappPermissionGuides,
} from './guides'
export {
  SettingsHelpProvider,
  useSettingsHelp,
} from './SettingsHelpContext'
export type { SettingsHelpContextValue } from './SettingsHelpContext'
export { SettingsHelpToggle } from './SettingsHelpToggle'
export type { SettingsHelpToggleProps } from './SettingsHelpToggle'
export {
  SettingsPageActionsProvider,
  useSettingsPageActions,
} from './SettingsPageActionsContext'
export type { SettingsPageActionsContextValue } from './SettingsPageActionsContext'
export { SettingsPageResetButton } from './SettingsPageResetButton'
export type { SettingsPageResetButtonProps } from './SettingsPageResetButton'
export { SetupFlow } from './SetupFlow'
export type { SetupFlowProps, SetupFlowStep } from './SetupFlow'
// 核心组件
export { SettingItem } from './SettingItem'

export { SettingSection } from './SettingSection'
// 类型导出
export type {
  BaseSettingItemConfig,
  ButtonSettingConfig,
  CheckboxSettingConfig,
  CustomSettingConfig,
  InfoCardConfig,
  InputItemVariant,
  InputSettingConfig,
  NumberSettingConfig,
  PermissionGroupConfig,
  PermissionItem,
  ProviderSettingConfig,
  QuotaGroupConfig,
  QuotaItem,
  SelectSettingConfig,
  SettingGroupConfig,
  SettingGroupSwitchConfig,
  SettingItemConfig,
  SettingLayout,
  SettingOption,
  SettingSectionConfig,
  SettingSize,
  SettingType,
  SliderSettingConfig,
  SwitchSettingConfig,
} from './types'
