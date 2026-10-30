/**
 * 8-Bit Retro Sound Synthesizer via Web Audio API
 * Zero external audio files required, instant latency, zero failure rate.
 */

class SoundEffects {
  private ctx: AudioContext | null = null
  private enabled: boolean = true

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  /** Subtle retro pop for speech bubble appearance */
  public playPop() {
    if (!this.enabled) return
    this.initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.08)
  }

  /** Retro blip on button press or checkbox toggle */
  public playClick() {
    if (!this.enabled) return
    this.initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.setValueAtTime(900, now + 0.02)

    gain.gain.setValueAtTime(0.05, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.05)
  }

  /** Uplifting retro 8-bit fanfare for task completion */
  public playSuccess() {
    if (!this.enabled) return
    this.initContext()
    if (!this.ctx) return

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    const startTime = this.ctx.currentTime

    notes.forEach((freq, idx) => {
      if (!this.ctx) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      const noteStart = startTime + idx * 0.07
      const noteEnd = noteStart + 0.12

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, noteStart)

      gain.gain.setValueAtTime(0.09, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.001, noteEnd)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(noteStart)
      osc.stop(noteEnd)
    })
  }

  /** Attention bell for task due or pomodoro timer done */
  public playAlert() {
    if (!this.enabled) return
    this.initContext()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.setValueAtTime(600, now + 0.1)
    osc.frequency.setValueAtTime(1000, now + 0.2)

    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + 0.35)
  }
}

export const sounds = new SoundEffects()
