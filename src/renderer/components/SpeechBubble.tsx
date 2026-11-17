import React, { useState, useEffect } from 'react'
import type { BubbleMessage, SpriteState } from '../types'

interface SpeechBubbleProps {
  message: BubbleMessage | null
  spriteState?: SpriteState
  onClose?: () => void
  onAction?: (actionData?: string) => void
  onYes?: () => void
  onNo?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  message,
  spriteState,
  onClose,
  onAction,
  onYes,
  onNo,
  onMouseEnter,
  onMouseLeave
}) => {
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!message?.text) {
      setTypedText('')
      setIsTyping(false)
      return
    }

    // Use Array.from so multi-byte emojis (🐾, ⏰, 🔥, 😢) type cleanly as whole characters
    const chars = Array.from(message.text)
    let index = 0
    setTypedText('')
    setIsTyping(true)

    const interval = setInterval(() => {
      index += 1
      setTypedText(chars.slice(0, index).join(''))
      if (index >= chars.length) {
        clearInterval(interval)
        setIsTyping(false)
      }
    }, 28)

    return () => clearInterval(interval)
  }, [message?.text])

  if (!message) return null

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onAction) onAction(message.actionData)
  }

  const stateClass =
    spriteState === 'sleep' ? 'bubble-sleep' : spriteState === 'fly' ? 'bubble-fly' : ''

  return (
    <div
      className={`speech-bubble-bridge ${stateClass}`.trim()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => {
        if (e.button !== 0) return
        handleTrigger(e)
      }}
      onClick={handleTrigger}
    >
      <div className="speech-bubble" title="Click to open Quests & Settings">
        {onClose && (
          <button
            type="button"
            className="speech-bubble-dismiss-btn"
            title="Dismiss bubble"
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onClose()
            }}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onClose()
            }}
          >
            ×
          </button>
        )}
        <div className="speech-bubble-inner">
          <span className="speech-bubble-typewriter">
            {typedText}
            {isTyping && <span className="typewriter-cursor">▋</span>}
          </span>
          {message.showYesNo && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
              <button
                type="button"
                className="paper-btn-dark"
                style={{ flex: 1, padding: '7px 10px', fontSize: '9px' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (onYes) onYes()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                YES
              </button>
              <button
                type="button"
                className="paper-btn-ghost"
                style={{ flex: 1, padding: '7px 10px', fontSize: '11px' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (onNo) onNo()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
