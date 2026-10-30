import React, { useRef, useEffect } from 'react'
import type { SpriteState } from '../types'

interface CompanionSpriteProps {
  state: SpriteState
  scale?: number // target visual display width in px (default 238)
  facing?: 'left' | 'right'
  altitude?: number // optional live flight altitude (0 = on floor, ~12..24 = airborne)
}

// Compact logical pixel grid so Ash fills the canvas prominently
const LOGICAL_W = 68
const LOGICAL_H = 58
const OX = 34
const OY = 49 // Ground baseline row inside logical grid

// Curated Spirit Wolf Pixel Palette
const K: Record<string, string> = {
  o: '#0b0d1c', // Crisp 1px silhouette outline, nose, lashes
  n: '#252936', // Deepest slate shadow (far legs, deep creases)
  d: '#363c4d', // Dark slate fur (ears, lower legs, back shadow)
  m: '#525a6e', // Main slate wolf fur (head, torso, tail base, wings)
  l: '#8793a8', // Light slate fur (cheeks, chest ruff, upper tail tip, inner ears, wing feathers)
  p: '#b4c0d4', // Bright fur highlight
  t: '#7cebe0', // Bright spirit cyan (eyes, flame inner)
  T: '#2eb8ac', // Mid-deep spirit teal (flame outer, Zzz)
  w: '#ffffff', // Pure pixel white (eye sparkle, fangs, flame core)
  r: '#882938', // Angry inner mouth crimson
  tear: '#8fd3ff', // Sad falling tear blue
  bub: '#bff3ea'   // Reminder [!] alert bubble fill
}

const rd = Math.round

interface WolfPose {
  b: number
  hy: number
  p: number
  f: number
  tail: number
  eye: 'o' | 'c' | 'a' | 's' | 'O'
  droop: number
  tuck: number
  mouth: number
  wlk: number
  spreadWings: number
  paw?: number
}

function getPose(state: SpriteState, fr: number): WolfPose {
  const P: WolfPose = {
    b: 0,
    hy: 0,
    p: 0,
    f: 0.1,
    tail: 0,
    eye: 'o',
    droop: 0,
    tuck: 0,
    mouth: 0,
    wlk: 0,
    spreadWings: 0
  }

  if (state === 'idle') {
    P.b = fr % 12 < 6 ? 0 : 1
    P.tail = [0, 1, 2, 1][(fr >> 1) % 4] - 1
    P.f = 0.1 + (fr % 12 < 6 ? 0 : 0.15)
    if (fr % 40 > 37) P.eye = 'c'
  } else if (state === 'walk') {
    P.wlk = 1
    P.p = fr % 4
    P.b = [0, -1, 0, -1][P.p]
    P.tail = [-1, 0, 1, 0][P.p]
    P.f = 0.15
    if (fr % 45 > 42) P.eye = 'c'
  } else if (state === 'fly') {
    P.tuck = 1
    P.spreadWings = 1
    // Full 4-beat wing-flapping cycle: High Upstroke -> Wide Mid-Sweep -> Deep Downstroke -> Recovery
    P.f = [1.15, 0.1, -1.15, -0.25][fr % 4]
    P.b = [-1, 0, 2, 0][fr % 4]
    P.tail = [-1, 0, 1, 0][fr % 4]
  } else if (state === 'angry') {
    P.eye = 'a'
    P.mouth = 1
    P.f = 0.85
    P.tail = [-1, 1][fr % 2]
  } else if (state === 'sad') {
    P.hy = 3
    P.droop = 1
    P.eye = 's'
    P.f = -0.85
    P.tail = 2
    P.b = 1
  } else if (state === 'remind') {
    P.eye = 'O'
    P.paw = [0, -2, -1, 0][fr % 4]
    P.tail = [-1, 0, 1, 0][fr % 4]
    P.f = 0.25
  }

  return P
}

export const CompanionSprite: React.FC<CompanionSpriteProps> = ({
  state,
  scale = 165,
  facing = 'right',
  altitude
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Keep live props in a ref so the requestAnimationFrame loop NEVER resets its clock on prop updates!
  const propsRef = useRef({ state, facing, altitude })
  propsRef.current = { state, facing, altitude }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Render at 4x integer scale of the 68x58 logical pixel buffer for razor-sharp blocks
    const PIXEL_SCALE = 4
    canvas.width = LOGICAL_W * PIXEL_SCALE
    canvas.height = LOGICAL_H * PIXEL_SCALE
    ctx.imageSmoothingEnabled = false

    const spr = document.createElement('canvas')
    spr.width = LOGICAL_W
    spr.height = LOGICAL_H
    const s = spr.getContext('2d')!
    s.imageSmoothingEnabled = false

    const sil = document.createElement('canvas')
    sil.width = LOGICAL_W
    sil.height = LOGICAL_H
    const z = sil.getContext('2d')!
    z.imageSmoothingEnabled = false

    const scene = document.createElement('canvas')
    scene.width = LOGICAL_W
    scene.height = LOGICAL_H
    const x = scene.getContext('2d')!
    x.imageSmoothingEnabled = false

    const R = (a: number, b: number, w: number, h: number, c: string) => {
      s.fillStyle = K[c] || c
      s.fillRect(OX + rd(a), OY + rd(b), rd(w), rd(h))
    }

    const Q = (a: number, b: number, w: number, h: number, c: string) => {
      x.fillStyle = K[c] || c
      x.fillRect(rd(a), rd(b), rd(w), rd(h))
    }

    const L = (x0: number, y0: number, x1: number, y1: number, w: number, c: string) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0 || 1
      for (let i = 0; i <= n; i++) {
        R(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, w, c)
      }
    }

    const drawShoulderWing = (P: WolfPose, bx: number, by: number, dirSide: number, isSpread: number) => {
      if (isSpread) {
        // Articulated shoulder arch + 4 fanning feathers that sweep high up and deep down!
        const archX = bx + dirSide * 5
        const archY = by + P.b - rd(P.f * 5)
        L(bx, by + P.b, archX, archY, 3, 'm')

        const feathers = [
          { span: 16, lift: -P.f * 13 - 2, c: 'p', w: 2 },
          { span: 14, lift: -P.f * 11 + 1, c: 'l', w: 2 },
          { span: 11, lift: -P.f * 8 + 4, c: 'l', w: 2 },
          { span: 8, lift: -P.f * 5 + 6, c: 'm', w: 2 }
        ]
        feathers.forEach((ft) => {
          L(archX, archY, bx + dirSide * ft.span, by + P.b + ft.lift, ft.w, ft.c)
        })
      } else {
        const tilt = -P.f * 4
        const feathers = [
          { dx: 6, dy: -4 + tilt, c: 'l' },
          { dx: 5, dy: -1 + tilt * 0.8, c: 'p' },
          { dx: 4, dy: 2 + tilt * 0.5, c: 'm' }
        ]
        feathers.forEach((f) => {
          L(bx, by + P.b, bx + dirSide * f.dx, by + P.b + f.dy, 2, f.c)
        })
      }
    }

    const drawWolf = (P: WolfPose) => {
      s.clearRect(0, 0, LOGICAL_W, LOGICAL_H)
      const b = P.b
      const hy = P.hy

      // 1. Upright Fluffy Two-Tone Spirit Wolf Tail
      const tailPts: [number, number, number, number, string][] = [
        [-10, -6, 5, 5, 'd'],
        [-14, -9, 6, 6, 'd'],
        [-17, -13, 7, 6, 'm'],
        [-18, -18, 7, 6, 'l'],
        [-17, -22, 5, 5, 'l'],
        [-15, -24, 3, 3, 'p']
      ]
      tailPts.forEach(([tx, ty, tw, th, tc], i) => {
        const wagX = P.tail * i * 0.45
        const wagY = P.droop ? i * 1.1 : Math.abs(P.tail) * i * 0.2
        R(tx + wagX, ty + b + wagY, tw, th, tc)
      })
      R(-16 + P.tail * 1.2, -19 + b + (P.droop ? 3 : 0), 3, 4, 'p')

      // 2. Shoulder Spirit Wings (both left & right shoulders)
      drawShoulderWing(P, -7, -14, -1, P.spreadWings)
      drawShoulderWing(P, 8, -14, 1, P.spreadWings)

      // 3. Four Articulated Quadruped Legs
      const legs: [number, number, string, boolean][] = [
        [-9, 0, 'n', false],
        [-6, 2, 'd', false],
        [1, 2, 'n', true],
        [4, 0, 'd', true]
      ]
      legs.forEach(([lx, off, c, isFront], k) => {
        if (k === 3 && P.paw !== undefined) {
          R(6, -13 + b, 5, 3, 'd')
          R(9, -16 + b + P.paw, 4, 4, 'm')
          R(10, -16 + b + P.paw, 2, 2, 'l')
          return
        }
        if (P.tuck) {
          const tuckY = isFront ? -8 : -6
          R(lx, tuckY + b, 3, 4, c)
          R(lx, tuckY + 3 + b, 3, 1, 'l')
          return
        }
        const phase = (P.p + off) % 4
        const dx = P.wlk ? [2, 0, -2, 0][phase] : 0
        const lift = P.wlk ? [0, 0, 0, 2][phase] : 0
        R(lx + dx, -6, 3, 6 - lift, c)
        R(lx + dx, -1 - lift, 3, 1, 'l')
      })

      // 4. Torso & Fluffy Light-Slate Chest Ruff
      R(-9, -15 + b, 15, 9, 'd')
      R(-7, -14 + b, 13, 7, 'm')
      R(-2, -14 + b, 8, 6, 'l')
      R(-1, -8 + b, 6, 3, 'l')
      R(0, -13 + b, 5, 4, 'p')
      R(-1, -12 + b, 1, 2, 'd')

      // 5. Cute 3/4 Chibi Wolf Head
      const hx = -5
      const hy0 = -27 + b + hy

      // Ears
      if (P.droop) {
        R(hx - 3, hy0 + 2, 5, 3, 'd')
        R(hx - 4, hy0 + 3, 3, 2, 'd')
        R(hx - 2, hy0 + 3, 2, 1, 'l')
        R(hx + 14, hy0 + 2, 5, 3, 'd')
        R(hx + 16, hy0 + 3, 3, 2, 'd')
        R(hx + 15, hy0 + 3, 2, 1, 'l')
      } else {
        R(hx + 0, hy0 - 4, 5, 5, 'd')
        R(hx + 1, hy0 - 6, 3, 2, 'd')
        R(hx + 1, hy0 - 7, 2, 1, 'd')
        R(hx + 2, hy0 - 4, 2, 4, 'l')

        R(hx + 11, hy0 - 4, 5, 5, 'd')
        R(hx + 12, hy0 - 6, 3, 2, 'd')
        R(hx + 13, hy0 - 7, 2, 1, 'd')
        R(hx + 12, hy0 - 4, 2, 4, 'l')
      }

      // Main Head Dome
      R(hx + 1, hy0, 14, 11, 'm')
      R(hx + 0, hy0 + 2, 16, 8, 'm')
      R(hx + 3, hy0 - 1, 10, 2, 'm')
      R(hx + 6, hy0 - 2, 3, 1, 'm')

      // Fluffy Cheek Ruffs & Lower Muzzle
      R(hx - 1, hy0 + 6, 18, 4, 'l')
      R(hx + 1, hy0 + 9, 14, 3, 'l')
      R(hx + 3, hy0 + 11, 10, 1, 'l')

      // Cute Eyebrow Beans
      if (P.eye !== 'a' && P.eye !== 's') {
        R(hx + 4, hy0 + 2, 2, 1, 'l')
        R(hx + 11, hy0 + 2, 2, 1, 'l')
      }

      // Two Expressive Cyan Eyes
      const ey = hy0 + 4
      if (P.eye === 'c') {
        R(hx + 3, ey + 1, 3, 1, 'o')
        R(hx + 11, ey + 1, 3, 1, 'o')
      } else if (P.eye === 'a') {
        R(hx + 3, ey, 3, 2, 't')
        R(hx + 11, ey, 3, 2, 't')
        R(hx + 4, ey, 1, 1, 'w')
        R(hx + 12, ey, 1, 1, 'w')
        R(hx + 2, ey - 2, 2, 1, 'o')
        R(hx + 4, ey - 1, 3, 1, 'o')
        R(hx + 10, ey - 1, 3, 1, 'o')
        R(hx + 13, ey - 2, 2, 1, 'o')
      } else if (P.eye === 's') {
        R(hx + 3, ey, 3, 2, 't')
        R(hx + 11, ey, 3, 2, 't')
        R(hx + 3, ey, 1, 1, 'w')
        R(hx + 11, ey, 1, 1, 'w')
        R(hx + 2, ey - 1, 2, 1, 'o')
        R(hx + 4, ey - 2, 3, 1, 'o')
        R(hx + 10, ey - 2, 3, 1, 'o')
        R(hx + 13, ey - 1, 2, 1, 'o')
      } else if (P.eye === 'O') {
        R(hx + 3, ey - 1, 3, 3, 't')
        R(hx + 11, ey - 1, 3, 3, 't')
        R(hx + 4, ey - 1, 1, 1, 'w')
        R(hx + 12, ey - 1, 1, 1, 'w')
        R(hx + 3, ey - 2, 3, 1, 'o')
        R(hx + 11, ey - 2, 3, 1, 'o')
      } else {
        R(hx + 3, ey, 3, 2, 't')
        R(hx + 11, ey, 3, 2, 't')
        R(hx + 3, ey, 1, 1, 'w')
        R(hx + 11, ey, 1, 1, 'w')
        R(hx + 3, ey - 1, 3, 1, 'o')
        R(hx + 11, ey - 1, 3, 1, 'o')
      }

      // Centered Dark Wolf Nose
      R(hx + 7, hy0 + 6, 3, 2, 'o')

      // Mouth / Snarl
      if (P.mouth) {
        R(hx + 6, hy0 + 9, 5, 2, 'r')
        R(hx + 6, hy0 + 9, 1, 1, 'w')
        R(hx + 10, hy0 + 9, 1, 1, 'w')
      } else {
        R(hx + 7, hy0 + 9, 3, 1, 'o')
      }
    }

    const drawSleepWolf = (fr: number) => {
      s.clearRect(0, 0, LOGICAL_W, LOGICAL_H)
      const b = fr % 14 < 7 ? 0 : -1
      R(-13, -9, 24, 9, 'n')
      R(-12, -11 + b, 22, 7, 'd')
      R(-9, -5, 18, 5, 'm')
      R(-6, -15 + b, 10, 4, 'm')
      R(-4, -16 + b, 6, 2, 'l')
      R(-17, -7, 12, 7, 'm')
      R(-19, -6, 8, 6, 'l')
      R(-18, -5, 4, 4, 'p')
      const hx = -1
      const hy0 = -15 + b
      R(hx + 1, hy0, 14, 10, 'm')
      R(hx, hy0 + 5, 16, 4, 'l')
      R(hx + 2, hy0 + 8, 12, 2, 'l')
      R(hx, hy0 - 3, 4, 4, 'd')
      R(hx + 1, hy0 - 2, 2, 2, 'l')
      R(hx + 11, hy0 - 3, 4, 4, 'd')
      R(hx + 12, hy0 - 2, 2, 2, 'l')
      R(hx + 3, hy0 + 4, 3, 1, 'o')
      R(hx + 10, hy0 + 4, 3, 1, 'o')
      R(hx + 7, hy0 + 6, 2, 2, 'o')
    }

    const drawFlame = (cx: number, cy: number, big: boolean, fr: number, alpha: number) => {
      x.globalAlpha = alpha
      const rows = big ? [1, 3, 3, 5, 5, 5, 3] : [1, 3, 3, 1]
      const fl = fr % 2
      rows.forEach((w, i) => {
        Q(cx - (w >> 1) + (i < 2 ? fl : 0), cy + i, w, 1, i > rows.length - 3 ? 'T' : 't')
      })
      if (big) {
        Q(cx - 1, cy + 3, 3, 2, 'w')
      } else {
        Q(cx, cy + 2, 1, 1, 'w')
      }
      x.globalAlpha = 1
    }

    const startTime = performance.now()

    const render = (now: number) => {
      const { state: curState, facing: curFacing, altitude: curAlt } = propsRef.current
      const t = (now - startTime) / 1000
      const fr = Math.floor(t * 5.8) // Calm ~5.8 FPS stepped pixel animation (gentle walk & steady wing strokes)

      const localPy =
        curAlt !== undefined
          ? Math.min(8, curAlt * 0.35)
          : curState === 'fly'
            ? 7 + Math.sin(t * 2.5) * 1.5
            : 0

      const activeState: SpriteState = localPy > 1.8 || curState === 'fly' ? 'fly' : curState
      const dir = curFacing === 'left' ? -1 : 1

      x.clearRect(0, 0, LOGICAL_W, LOGICAL_H)

      // 1. Dynamic Pixel Ground Shadow on the floor baseline (OY + 1)
      const shadowW = Math.max(8, rd(22 - localPy * 0.9))
      x.globalAlpha = 0.28
      Q(OX - (shadowW >> 1), OY + 1, shadowW, 2, 'o')
      x.globalAlpha = 1

      // 2. Draw character onto low-res spr buffer
      if (activeState === 'sleep') {
        drawSleepWolf(fr)
      } else {
        drawWolf(getPose(activeState, fr))
      }

      // 3. Build 1px dark silhouette outline in sil buffer
      z.globalCompositeOperation = 'source-over'
      z.clearRect(0, 0, LOGICAL_W, LOGICAL_H)
      z.drawImage(spr, 0, 0)
      z.globalCompositeOperation = 'source-in'
      z.fillStyle = K.o
      z.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

      // 4. Composite outlined sprite with horizontal direction flip & angry tremble
      const shakeX = activeState === 'angry' ? (fr % 2 ? 1 : -1) : 0
      const y0 = -rd(localPy)

      x.save()
      x.translate(OX + shakeX, 0)
      x.scale(dir, 1)
      const offsets: [number, number][] = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]
      offsets.forEach(([da, db]) => {
        x.drawImage(sil, -OX + da, y0 + db)
      })
      x.drawImage(spr, -OX, y0)
      x.restore()

      // 5. Pixel Spirit Flames & Expressive State Particles
      const top = OY - rd(localPy)
      if (activeState === 'angry') {
        const pts: [number, number][] = [
          [-15, -36],
          [0, -43],
          [15, -36]
        ]
        pts.forEach(([a, b], i) => {
          drawFlame(OX + a, top + b + rd(Math.sin(t * 5 + i) * 1.5), true, fr + i, 1)
        })
      } else if (activeState === 'sleep') {
        const pts: [number, number][] = [
          [-16, -22],
          [16, -20]
        ]
        pts.forEach(([a, b], i) => {
          drawFlame(OX + a, top + b + rd(Math.sin(t * 2 + i) * 1.5), false, fr + i, 0.55)
        })
      } else if (activeState === 'sad') {
        const pts: [number, number][] = [
          [-15, -30],
          [15, -28]
        ]
        pts.forEach(([a, b], i) => {
          drawFlame(OX + a, top + b + rd(Math.sin(t * 2 + i) * 1.5), false, fr + i, 0.55)
        })
      } else {
        const pts: [number, number][] = [
          [-19, -28],
          [18, -30],
          [20, -13]
        ]
        pts.forEach(([a, b], i) => {
          drawFlame(OX + a, top + b + rd(Math.sin(t * 3 + i * 2) * 2), false, fr + i, 1)
        })
      }

      // Sleeping rising pixel Zzz
      if (activeState === 'sleep') {
        ;[0, 1, 2].forEach((i) => {
          const k = (fr / 3 + i * 4) % 12
          const zx = OX + 9 + k
          const zy = top - 22 - k * 1.2
          if (k < 10) {
            Q(zx, zy, 3, 1, 'T')
            Q(zx + 1, zy + 1, 1, 1, 'T')
            Q(zx, zy + 2, 3, 1, 'T')
          }
        })
      }

      // Sad falling pixel tear drops from both eyes
      if (activeState === 'sad') {
        const k = fr % 6
        const eyeOffsets = [dir * -1, dir * 7]
        eyeOffsets.forEach((a, i) => {
          Q(OX + a, top - 16 + ((k + i * 3) % 6) * 2, 1, 2, 'tear')
        })
      }

      // Reminder pulsing [!] pixel alert bubble
      if (activeState === 'remind' && fr % 6 < 5) {
        const bx = OX + (dir > 0 ? 11 : -23)
        const by = top - 40
        Q(bx - 1, by - 1, 13, 13, 'o')
        Q(bx, by, 11, 11, 'bub')
        Q(bx + (dir > 0 ? 1 : 7), by + 11, 3, 2, 'bub')
        Q(bx + 5, by + 2, 2, 5, 'o')
        Q(bx + 5, by + 8, 2, 2, 'o')
      }

      // 6. Scale low-res scene buffer up to main display canvas with crisp nearest-neighbor edges
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(scene, 0, 0, canvas.width, canvas.height)

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        lineHeight: 0
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${scale}px`,
          height: `${Math.round((scale * LOGICAL_H) / LOGICAL_W)}px`,
          display: 'block',
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 5px 12px rgba(0, 0, 0, 0.5))'
        }}
      />
    </div>
  )
}
