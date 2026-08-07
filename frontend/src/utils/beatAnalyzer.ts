/**
 * 节拍网格分析器 —— 预载全曲离线分析，输出精确节拍网格
 *
 * 方法（Ellis 2007 "Beat Tracking by Dynamic Programming" 的轻量化）：
 *  1. 解码全曲 → 单声道降采样 ~11kHz
 *  2. 谱通量 onset 包络（512 窗 / 128 hop，对数幅度差半波整流）
 *  3. 自相关找节拍周期（55~200 BPM），带 120 BPM 对数正态先验
 *  4. comb 扫描找相位，逐拍 ±12% 局部吸附到包络峰
 *
 * 供 Tapp 桥接（media.getBeatGrid）调用：可视化按网格预测跟拍，
 * 消除实时检测的固有滞后（轮询 + 包络平滑 ≈ 70~130ms）。
 */

export interface BeatGrid {
  bpm: number
  beats: number[] // 每拍时间（秒，音频时间轴）
  accents: number[] // 重音拍在 beats 中的索引（拍峰值全曲统计显著者）
  confidence: number // 0-1，自相关峰值显著性
}

// 每首歌只分析一次（缓存 Promise 以去重并发请求）
const gridCache = new Map<string, Promise<BeatGrid | null>>()

/** 就地迭代 FFT（radix-2 Cooley-Tukey） */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let curR = 1
      let curI = 0
      for (let k = 0; k < half; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + half] * curR - im[i + k + half] * curI
        const vi = re[i + k + half] * curI + im[i + k + half] * curR
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + half] = ur - vr
        im[i + k + half] = ui - vi
        const nr = curR * wr - curI * wi
        curI = curR * wi + curI * wr
        curR = nr
      }
    }
  }
}

async function analyze(url: string): Promise<BeatGrid | null> {
  // 1. 拉取 + 解码
  const resp = await fetch(url)
  if (!resp.ok) return null
  const raw = await resp.arrayBuffer()
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  const ctx = new AC()
  let audio: AudioBuffer
  try {
    audio = await ctx.decodeAudioData(raw)
  } finally {
    void ctx.close()
  }
  // 超长音频不分析（内存保护）
  if (audio.duration > 900 || audio.duration < 10) return null

  // 2. 单声道 + 降采样到 ~11kHz
  const sr = audio.sampleRate
  const down = Math.max(1, Math.round(sr / 11025))
  const dsr = sr / down
  const ch0 = audio.getChannelData(0)
  const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null
  const n = Math.floor(ch0.length / down)
  const mono = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const s = i * down
    mono[i] = ch1 ? (ch0[s] + ch1[s]) * 0.5 : ch0[s]
  }

  // 3. 谱通量 onset 包络
  const win = 512
  const hop = 128
  const frames = Math.floor((n - win) / hop)
  if (frames < 400) return null
  const env = new Float32Array(frames)
  const re = new Float32Array(win)
  const im = new Float32Array(win)
  const prevMag = new Float32Array(win / 2)
  const hann = new Float32Array(win)
  for (let i = 0; i < win; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win)
  }
  for (let f = 0; f < frames; f++) {
    const off = f * hop
    for (let i = 0; i < win; i++) {
      re[i] = mono[off + i] * hann[i]
      im[i] = 0
    }
    fft(re, im)
    let flux = 0
    for (let k = 1; k < win / 2; k++) {
      const mag = Math.log(1 + 10 * Math.hypot(re[k], im[k]))
      const d = mag - prevMag[k]
      if (d > 0) flux += d
      prevMag[k] = mag
    }
    env[f] = flux
    // 分块让出主线程，避免长任务卡 UI
    if ((f & 2047) === 2047) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // 4. 平滑 + 去均值（半波）
  const smooth = new Float32Array(frames)
  let ema = 0
  for (let i = 0; i < frames; i++) {
    ema += (env[i] - ema) * 0.4
    smooth[i] = ema
  }
  let mean = 0
  for (let i = 0; i < frames; i++) mean += smooth[i]
  mean /= frames
  for (let i = 0; i < frames; i++) {
    smooth[i] = Math.max(0, smooth[i] - mean)
  }

  // 5. 自相关找周期（55~200 BPM），120 BPM 对数正态先验
  const fps = dsr / hop
  const minLag = Math.max(4, Math.round((fps * 60) / 200))
  const maxLag = Math.min(frames >> 1, Math.round((fps * 60) / 55))
  let bestLag = 0
  let bestScore = 0
  let scoreSum = 0
  let scoreCnt = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0
    for (let i = 0; i + lag < frames; i += 2) {
      r += smooth[i] * smooth[i + lag]
    }
    const bpm = (60 * fps) / lag
    const prior = Math.exp(-0.5 * ((Math.log2(bpm / 120) / 0.9) ** 2))
    const s = r * prior
    scoreSum += s
    scoreCnt++
    if (s > bestScore) {
      bestScore = s
      bestLag = lag
    }
  }
  if (!bestLag || scoreCnt === 0) return null
  const ratio = bestScore / (scoreSum / scoreCnt)
  const confidence = Math.max(0, Math.min(1, (ratio - 1.2) / 3.5))

  // 6. comb 扫描找相位
  let bestP = 0
  let bestPS = -1
  for (let p = 0; p < bestLag; p++) {
    let s = 0
    for (let i = p; i < frames; i += bestLag) s += smooth[i]
    if (s > bestPS) {
      bestPS = s
      bestP = p
    }
  }

  // 7. 生成拍点，逐拍 ±12% 吸附到局部包络峰（容忍轻微 tempo 漂移），
  //    同时记录每拍峰值供重音标注
  const beats: number[] = []
  const peaks: number[] = []
  const snapW = Math.max(2, Math.round(bestLag * 0.12))
  for (let f = bestP; f < frames; f += bestLag) {
    let m = f
    let mv = -1
    const lo = Math.max(0, f - snapW)
    const hi = Math.min(frames - 1, f + snapW)
    for (let k = lo; k <= hi; k++) {
      if (smooth[k] > mv) {
        mv = smooth[k]
        m = k
      }
    }
    beats.push((m * hop + win / 2) / dsr)
    peaks.push(mv)
  }

  // 8. 重音标注：拍峰值 > 全曲拍峰均值 + 1.5σ ——「明确被强调」的拍
  //    （全曲统计显著，而非碰巧比邻拍响一点）
  let pMean = 0
  for (let i = 0; i < peaks.length; i++) pMean += peaks[i]
  pMean /= peaks.length || 1
  let pVar = 0
  for (let i = 0; i < peaks.length; i++) {
    pVar += (peaks[i] - pMean) ** 2
  }
  const pStd = Math.sqrt(pVar / (peaks.length || 1))
  const accents: number[] = []
  const accThreshold = pMean + 1.5 * pStd
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > accThreshold) accents.push(i)
  }

  return {
    bpm: Math.round(((60 * fps) / bestLag) * 10) / 10,
    beats,
    accents,
    confidence,
  }
}

/**
 * 获取节拍网格（带缓存与并发去重）
 * @param url 音频 URL（与播放同源，通常命中 HTTP 缓存）
 * @param cacheKey 歌曲唯一键（source-songId）
 */
export function analyzeBeatGrid(
  url: string,
  cacheKey: string,
): Promise<BeatGrid | null> {
  let p = gridCache.get(cacheKey)
  if (!p) {
    p = analyze(url).catch((e) => {
      console.warn('[beatAnalyzer] analysis failed:', e)
      return null
    })
    gridCache.set(cacheKey, p)
    // 上限保护：最多缓存 20 首
    if (gridCache.size > 20) {
      const first = gridCache.keys().next().value
      if (first) gridCache.delete(first)
    }
  }
  return p
}
