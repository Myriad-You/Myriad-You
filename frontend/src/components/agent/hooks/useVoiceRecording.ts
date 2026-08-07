/**
 * useVoiceRecording - 语音录制 hook
 *
 * 从 AraelPanel 提取的完整语音录制流程：
 * - 使用 AudioWorklet 采集 PCM（替代已弃用的 ScriptProcessorNode）
 * - 转换为 WAV 格式
 * - 调用 ASR 服务识别文字
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  audioToBase64,
  getSpeechStatus,
  speechToText,
} from '../../../services/speechApi'

interface RecorderState {
  audioContext: AudioContext
  stream: MediaStream
  workletNode: AudioWorkletNode
  muteNode: GainNode
  pcmData: Float32Array[]
}

const LOCALE_ENGINE_MAP: Record<string, string> = {
  'zh-CN': '16k_zh',
  'en-US': '16k_en',
  'ja-JP': '16k_ja',
}

const WORKLET_PROCESSOR_NAME = 'pcm-capture-processor'

/** Inline AudioWorklet processor — no separate asset / Vite plugin needed. */
const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel.length)
      copy.set(channel)
      this.port.postMessage(copy, [copy.buffer])
    }
    return true
  }
}
registerProcessor('${WORKLET_PROCESSOR_NAME}', PcmCaptureProcessor)
`

async function createPcmCaptureNode(
  audioContext: AudioContext,
): Promise<AudioWorkletNode> {
  if (!audioContext.audioWorklet) {
    throw new Error('AudioWorklet is not supported in this browser')
  }

  const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  try {
    await audioContext.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }

  return new AudioWorkletNode(audioContext, WORKLET_PROCESSOR_NAME)
}

function cleanupRecorder(recorder: RecorderState) {
  try {
    recorder.workletNode.port.onmessage = null
    recorder.workletNode.disconnect()
  } catch {
    // already disconnected
  }
  try {
    recorder.muteNode.disconnect()
  } catch {
    // already disconnected
  }
  recorder.stream.getTracks().forEach((track) => track.stop())
  void recorder.audioContext.close()
}

export function useVoiceRecording(
  onResult: (text: string) => void,
  locale: string = 'zh-CN',
) {
  const [speechAvailable, setSpeechAvailable] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const recorderRef = useRef<RecorderState | null>(null)
  // Keep latest isRecording for stop without stale closures
  const isRecordingRef = useRef(false)

  useEffect(() => {
    getSpeechStatus()
      .then((s) => setSpeechAvailable(s.available && !!s.asr_enabled))
      .catch(() => {})
  }, [])

  const pcmToWav = useCallback(
    (pcmData: Float32Array[], sampleRate: number): Blob => {
      const totalLength = pcmData.reduce((acc, arr) => acc + arr.length, 0)
      const merged = new Float32Array(totalLength)
      let offset = 0
      for (const arr of pcmData) {
        merged.set(arr, offset)
        offset += arr.length
      }

      const buffer = new ArrayBuffer(44 + merged.length * 2)
      const view = new DataView(buffer)

      const writeString = (off: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(off + i, string.charCodeAt(i))
        }
      }

      writeString(0, 'RIFF')
      view.setUint32(4, 36 + merged.length * 2, true)
      writeString(8, 'WAVE')
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, 1, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      writeString(36, 'data')
      view.setUint32(40, merged.length * 2, true)

      const int16MinMagnitude = 32768
      const int16Max = 32767
      let dataOffset = 44
      for (let i = 0; i < merged.length; i++) {
        const sample = Math.max(-1, Math.min(1, merged[i]))
        view.setInt16(
          dataOffset,
          sample < 0 ? sample * int16MinMagnitude : sample * int16Max,
          true,
        )
        dataOffset += 2
      }

      return new Blob([buffer], { type: 'audio/wav' })
    },
    [],
  )

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || recorderRef.current) return

    try {
      void import('../../../utils/analyticsEvents').then(
        ({ trackProductEvent, AnalyticsEvents }) => {
          trackProductEvent(AnalyticsEvents.AGENT_VOICE, { throttleMs: 5000 })
        },
      )
      const status = await getSpeechStatus()
      if (!status.available || !status.asr_enabled) return

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      const audioContext = new AudioContext({ sampleRate: 16000 })
      const pcmData: Float32Array[] = []

      let workletNode: AudioWorkletNode
      try {
        workletNode = await createPcmCaptureNode(audioContext)
      } catch (err) {
        stream.getTracks().forEach((track) => track.stop())
        await audioContext.close()
        throw err
      }

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        pcmData.push(event.data)
      }

      // Keep the graph alive without routing mic audio to speakers
      const muteNode = audioContext.createGain()
      muteNode.gain.value = 0

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(workletNode)
      workletNode.connect(muteNode)
      muteNode.connect(audioContext.destination)

      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      recorderRef.current = {
        audioContext,
        stream,
        workletNode,
        muteNode,
        pcmData,
      }
      isRecordingRef.current = true
      setIsRecording(true)
    } catch (err) {
      console.error('[useVoiceRecording] 无法访问麦克风:', err)
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !isRecordingRef.current) return

    isRecordingRef.current = false
    setIsRecording(false)

    const sampleRate = recorder.audioContext.sampleRate || 16000
    const pcmData = recorder.pcmData
    cleanupRecorder(recorder)
    recorderRef.current = null

    if (pcmData.length === 0) return

    setIsProcessingVoice(true)

    try {
      const wavBlob = pcmToWav(pcmData, sampleRate)
      const base64Audio = await audioToBase64(wavBlob)
      const result = await speechToText({
        audio_data: base64Audio,
        format: 'wav',
        engine: LOCALE_ENGINE_MAP[locale] || '16k_zh',
      })

      if (result.success && result.text) {
        onResult(result.text)
      }
    } catch (err) {
      console.error('[useVoiceRecording] 语音识别出错:', err)
    } finally {
      setIsProcessingVoice(false)
    }
  }, [pcmToWav, onResult, locale])

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      void stopRecording()
    } else {
      void startRecording()
    }
  }, [startRecording, stopRecording])

  // Unmount cleanup
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder) {
        isRecordingRef.current = false
        cleanupRecorder(recorder)
        recorderRef.current = null
      }
    }
  }, [])

  return {
    speechAvailable,
    isRecording,
    isProcessingVoice,
    startRecording,
    stopRecording,
    toggleRecording,
  }
}
