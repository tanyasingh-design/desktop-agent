import React from 'react'
import type { SpriteState } from '../types'

import idleImg from '../assets/sprites/idle.png'
import flyImg from '../assets/sprites/fly.png'
import sleepImg from '../assets/sprites/sleep.png'
import snackImg from '../assets/sprites/snack.png'
import remindImg from '../assets/sprites/remind.png'

interface CompanionSpriteProps {
  state: SpriteState
  scale?: number
}

const spriteMap: Record<SpriteState, string> = {
  idle: idleImg,
  fly: flyImg,
  sleep: sleepImg,
  snack: snackImg,
  remind: remindImg
}

const animClassMap: Record<SpriteState, string> = {
  idle: 'anim-idle',
  fly: 'anim-fly',
  sleep: 'anim-sleep',
  snack: 'anim-snack',
  remind: 'anim-remind'
}

export const CompanionSprite: React.FC<CompanionSpriteProps> = ({ state, scale = 130 }) => {
  const currentImg = spriteMap[state] || idleImg
  const animClass = animClassMap[state] || 'anim-idle'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {state === 'sleep' && (
        <div className="zzz-container">
          <span>z</span>
          <span style={{ fontSize: '14px', marginLeft: '3px' }}>Z</span>
          <span style={{ fontSize: '17px', marginLeft: '3px' }}>Z</span>
        </div>
      )}

      <img
        src={currentImg}
        alt={`Companion ${state}`}
        className={`companion-sprite ${animClass}`}
        style={{ width: `${scale}px` }}
        draggable={false}
      />
    </div>
  )
}
