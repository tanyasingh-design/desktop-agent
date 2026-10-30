import React, { useRef, useEffect } from 'react'
import type { SpriteState } from '../types'
import { PIXEL_SPRITES } from '../lib/pixel-data'

interface CompanionSpriteProps {
  state: SpriteState
  scale?: number // target visual display width in px (e.g. 130)
}

export const CompanionSprite: React.FC<CompanionSpriteProps> = ({ state, scale = 130 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Disable smoothing for razor-sharp pixel edges
    ctx.imageSmoothingEnabled = false

    const sprite = PIXEL_SPRITES[state] || PIXEL_SPRITES['idle']
    const pixelScale = 2 // Native grid scaling
    const canvasW = sprite.width * pixelScale
    const canvasH = sprite.height * pixelScale

    canvas.width = canvasW
    canvas.height = canvasH

    let isBlinking = false
    let nextBlinkTime = Date.now() + 3000 + Math.random() * 2000

    const render = () => {
      const now = Date.now()
      const elapsed = now - startTimeRef.current

      ctx.clearRect(0, 0, canvasW, canvasH)

      // Eye blink logic (idle/remind/snack states only)
      if (state !== 'sleep') {
        if (now > nextBlinkTime) {
          isBlinking = true
          if (now > nextBlinkTime + 180) {
            isBlinking = false
            nextBlinkTime = now + 3500 + Math.random() * 3000
          }
        }
      }

      // 1. Draw all character pixels from code
      const pixels = sprite.pixels
      const len = pixels.length

      // Dynamic vertical breathing bounce in code
      const breathOffset = state === 'idle' || state === 'sleep'
        ? Math.sin(elapsed * 0.003) * 1.5
        : state === 'fly'
        ? Math.sin(elapsed * 0.008) * 3
        : 0

      for (let i = 0; i < len; i++) {
        const [px, py, hex] = pixels[i]

        // If blinking and near eye height/x in face area, close eyelid
        if (isBlinking && hex === '#5ce1e6') {
          ctx.fillStyle = '#2b3345'
        } else {
          ctx.fillStyle = hex
        }

        ctx.fillRect(
          px * pixelScale,
          Math.round(py * pixelScale + breathOffset),
          pixelScale,
          pixelScale
        )
      }

      // 2. Procedural Floating Cyan Spirit Flame Wisps (in code)
      const wispPositions = [
        { baseX: 8, baseY: 14, speed: 0.004, phase: 0 },
        { baseX: 54, baseY: 12, speed: 0.0035, phase: 1.5 },
        { baseX: 58, baseY: 38, speed: 0.005, phase: 3.0 },
        { baseX: 6, baseY: 36, speed: 0.0045, phase: 4.5 }
      ]

      for (const wisp of wispPositions) {
        const floatY = Math.sin(elapsed * wisp.speed + wisp.phase) * 6
        const floatX = Math.cos(elapsed * (wisp.speed * 0.8) + wisp.phase) * 2
        const wx = Math.round((wisp.baseX + floatX) * pixelScale)
        const wy = Math.round((wisp.baseY + floatY + breathOffset) * pixelScale)

        // Draw pixelated flame core
        ctx.fillStyle = '#5ce1e6'
        ctx.fillRect(wx, wy, pixelScale * 2, pixelScale * 2)

        // Draw lighter center
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(wx + pixelScale / 2, wy + pixelScale / 2, pixelScale, pixelScale)

        // Draw flame aura
        ctx.fillStyle = 'rgba(92, 225, 230, 0.4)'
        ctx.fillRect(wx - pixelScale, wy, pixelScale, pixelScale * 2)
        ctx.fillRect(wx + pixelScale * 2, wy, pixelScale, pixelScale * 2)
        ctx.fillRect(wx, wy - pixelScale, pixelScale * 2, pixelScale)
      }

      // 3. Floating ZZZ particles during sleep (drawn in code)
      if (state === 'sleep') {
        const zProgress = (elapsed % 3000) / 3000
        const zX = Math.round((46 + zProgress * 8) * pixelScale)
        const zY = Math.round((16 - zProgress * 14) * pixelScale)

        ctx.fillStyle = `rgba(92, 225, 230, ${1 - zProgress * 0.8})`
        // Draw pixelated "Z"
        const p = pixelScale
        ctx.fillRect(zX, zY, p * 3, p)
        ctx.fillRect(zX + p * 2, zY + p, p, p)
        ctx.fillRect(zX + p, zY + p * 2, p, p)
        ctx.fillRect(zX, zY + p * 3, p * 3, p)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [state])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${scale}px`,
          height: 'auto',
          display: 'block',
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.55))'
        }}
      />
    </div>
  )
}
