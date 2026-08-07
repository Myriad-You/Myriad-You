/**
 * Manifest permission validation. Runtime authorization lives in TappBridge
 * and the backend Runtime Grant; this module intentionally keeps no usage or
 * role-derived authorization state.
 */

import type { TappManifest } from '../types'
import { PERMISSION_LEVELS } from './permissionConfig'

export class TappPermissionController {
  private constructor() {}

  static validateManifestPermissions(manifest: TappManifest): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    for (const permission of manifest.permissions) {
      if (!PERMISSION_LEVELS[permission]) {
        errors.push(`未知权限: ${permission}`)
      }
    }

    if (
      manifest.permissions.includes('platform:write') &&
      manifest.permissions.includes('ai:generate')
    ) {
      warnings.push('同时请求写入数据和 AI 生成权限，请确保应用来源可信')
    }

    return { valid: errors.length === 0, errors, warnings }
  }
}
