/**
 * Tapp 详情视图包装器
 * 解析 URL 参数并传递给 TappDetailPage
 */

import React from 'react'
import { useParams } from 'react-router-dom'
import AnimatedView from '../components/AnimatedView'
import { useI18n } from '../contexts/I18nContext'
import { TappDetailPage } from '../tapp/pages'
import '../components/ConfigForm.css'
import '../tapp/pages/TappDetailPage.css'

const TappDetailView: React.FC = () => {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const tappId = id ? decodeURIComponent(id) : ''

  if (!tappId) {
    return (
      <AnimatedView className="min-h-screen px-4 sm:px-6 pt-20 pb-24 md:pb-12">
        <div className="tapp-detail-page">
          <div className="config-section setting-section">
            <div className="tapp-detail-state">
              <p className="tapp-detail-state-desc">{t.tapp.appNotExist}</p>
            </div>
          </div>
        </div>
      </AnimatedView>
    )
  }

  return <TappDetailPage tappId={tappId} />
}

export default TappDetailView
