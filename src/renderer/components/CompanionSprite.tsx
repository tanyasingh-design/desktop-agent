import React, { useRef, useEffect } from 'react'
import type { SpriteState } from '../types'
import { PIXEL_SPRITES } from '../lib/pixel-data'

interface CompanionSpriteProps {
  state: SpriteState
  scale?: number // target visual display width in px (e.g. 130)
  facing?: 'left' | 'right'
}

export const CompanionSprite: React.FC<CompanionSpriteProps> = ({ state, scale = 130, facing = 'right' }) => {
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
    const pixelScale = 2
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

      // Eye blink logic (idle/walk/remind/snack states)
      if (state !== 'sleep') {
        if (now > nextBlinkTime) {
          isBlinking = true
          if (now > nextBlinkTime + 180) {
            isBlinking = false
            nextBlinkTime = now + 3500 + Math.random() * 3000
          }
        }
      }

      // Vertical offset:
      // ZERO offset for idle/sleep/remind/snack (firmly planted on the ground, NO floating!)
      // Flight has gentle bobbing
      const verticalOffset = state === 'fly' ? Math.sin(elapsed * 0.005) * 2 : 0

      // Dynamic Wing Flap in code for flight
      const isFlying = state === 'fly'
      const flapAngle = isFlying ? Math.sin(elapsed * 0.024) : 0

      // 1. Draw character pixels from code
      const pixels = sprite.pixels
      const len = pixels.length

      for (let i = 0; i < len; i++) {
        const [px, py, hex] = pixels[i]

        let drawY = py
        let drawX = px

        // Animate wings flapping up and down in fly state
        if (isFlying && py >= 16 && py <= 58) {
          // Left wing
          if (px < 23) {
            const distFromRoot = 23 - px
            const flapShift = Math.round(flapAngle * distFromRoot * 0.38)
            drawY = py + flapShift
          }
          // Right wing
          else if (px > 41) {
            const distFromRoot = px - 41
            const flapShift = Math.round(flapAngle * distFromRoot * 0.38)
            drawY = py + flapShift
          }
        }

        // If blinking and near eye height/x in face area, close eyelid
        if (isBlinking && (hex === '#5ce1e6' || hex === '#38bdf8')) {
          ctx.fillStyle = '#2b3345'
        } else {
          ctx.fillStyle = hex
        }

        ctx.fillRect(
          drawX * pixelScale,
          Math.round(drawY * pixelScale + verticalOffset),
          pixelScale,
          pixelScale
        )
      }

      // 2. Procedural Floating Cyan Spirit Flame Wisps
      const wispPositions = [
        { baseX: 8, baseY: 14, speed: 0.004, phase: 0 },
        { baseX: 54, baseY: 12, speed: 0.0035, phase: 1.5 },
        { baseX: 58, baseY: 38, speed: 0.005, phase: 3.0 },
        { baseX: 6, baseY: 36, speed: 0.0045, phase: 4.5 }
      ]

      for (const wisp of wispPositions) {
        const floatY = Math.sin(elapsed * wisp.speed + wisp.phase) * 5
        const floatX = Math.cos(elapsed * (wisp.speed * 0.8) + wisp.phase) * 2
        const wx = Math.round((wisp.baseX + floatX) * pixelScale)
        const wy = Math.round((wisp.baseY + floatY + verticalOffset) * pixelScale)

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

      // 3. Floating ZZZ particles during sleep
      if (state === 'sleep') {
        const zProgress = (elapsed % 3000) / 3000
        const zX = Math.round((46 + zProgress * 8) * pixelScale)
        const zY = Math.round((16 - zProgress * 14) * pixelScale)

        ctx.fillStyle = `rgba(92, 225, 230, ${1 - zProgress * 0.8})`
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
    <div
      className={`anim-${state} facing-${facing}`}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
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
