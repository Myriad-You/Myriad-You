/**
 * The official Tapp runs in an opaque-origin frame; no app source enters the site.
 * Every opening fetches one immutable snapshot. Appearance changes keep the form.
 */
import type { RemoteGeneratorBundle } from '../services/remoteGenerator'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { loadRemoteGenerator, remoteGeneratorSource } from '../services/remoteGenerator'
import { createGeneratorDocument } from '../tapp-runtime/bootstrap'
import { usePrimaryColor } from '../utils/colorSubscriber'
import { parseCssColor } from '../utils/readableColor'
import { useThemeMode } from '../utils/themeSubscriber'
import DetailModal from './DetailModal'

interface ConfigGeneratorModalProps {
  open: boolean
  onClose: () => void
}

function RemoteGeneratorFrame({ onClose }: { onClose: () => void }) {
  const { t, locale, format } = useI18n()
  const primaryColor = usePrimaryColor()
  const dark = useThemeMode()
  const rgb = parseCssColor(primaryColor)
  const primary = rgb
    ? `#${[rgb.r, rgb.g, rgb.b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`
    : '#6366f1'
  const appearance = useRef({ locale, primary, dark })
  appearance.current = { locale, primary, dark }
  const close = useRef(onClose)
  close.current = onClose
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ bundle: RemoteGeneratorBundle; document: string } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      controller.abort()
      setStatus('error')
    }, 45000)
    setLoaded(null)
    setStatus('loading')
    loadRemoteGenerator(controller.signal).then(bundle => {
      if (controller.signal.aborted) return
      const current = appearance.current
      setLoaded({
        bundle,
        document: createGeneratorDocument(bundle, current.locale, current),
      })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.warn('[Myriad generator] Unable to load the public application package', error)
        setStatus('error')
        controller.abort()
      }
    }).finally(() => window.clearTimeout(timeout))
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [attempt])

  useEffect(() => {
    if (!loaded) return
    const timeout = window.setTimeout(setStatus, 15000, 'error')
    const receive = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow ||
        event.data?.channel !== 'myriad-generator-runtime') {
        return
      }
      if (event.data.type === 'ready') {
        window.clearTimeout(timeout)
        setStatus('ready')
        frameRef.current?.contentWindow?.postMessage({
          channel: 'myriad-generator-runtime', type: 'appearance', ...appearance.current,
        }, '*')
      } else if (event.data.type === 'error') {
        window.clearTimeout(timeout)
        setStatus('error')
      } else if (event.data.type === 'close') {
        close.current()
      }
    }
    window.addEventListener('message', receive)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('message', receive)
    }
  }, [loaded])

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({
      channel: 'myriad-generator-runtime', type: 'appearance', locale, primary, dark,
    }, '*')
  }, [locale, primary, dark])

  const s = t.site.configGenerator
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {loaded ? format(s.loadedVersion, {
            version: loaded.bundle.version,
            revision: loaded.bundle.revision.slice(0, 7),
          }) : status === 'error' ? s.title : s.loading}
        </span>
        <a
          href={remoteGeneratorSource}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {s.source}
        </a>
      </div>
      <div className="relative overflow-hidden rounded-xl" style={{ height: 'min(65vh, 780px)' }}>
        {loaded && status !== 'error' && (
          <iframe
            key={attempt}
            ref={frameRef}
            srcDoc={loaded.document}
            title={s.title}
            sandbox="allow-scripts allow-downloads"
            allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0"
          />
        )}
        {status !== 'ready' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-(--bg-primary) p-6 text-center"
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <p>{status === 'error' ? s.loadError : s.loading}</p>
            {status === 'error' && (
              <button
                type="button"
                onClick={() => setAttempt(value => value + 1)}
                className="rounded-lg bg-(--text-primary) px-4 py-2 text-(--bg-primary)"
              >
                {s.retry}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfigGeneratorModal({ open, onClose }: ConfigGeneratorModalProps) {
  const { t } = useI18n()
  return (
    <DetailModal open={open} onClose={onClose} title={t.site.configGenerator.title}>
      {open && <RemoteGeneratorFrame onClose={onClose} />}
    </DetailModal>
  )
}

export default ConfigGeneratorModal
