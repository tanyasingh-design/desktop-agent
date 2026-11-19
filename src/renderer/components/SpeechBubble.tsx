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

  const stateClass =
    spriteState === 'sleep' ? 'bubble-sleep' : spriteState === 'fly' ? 'bubble-fly' : ''

  return (
    <div
      className={`speech-bubble-bridge ${stateClass}`.trim()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (message.showYesNo) return
        if (onAction) onAction(message.actionData)
      }}
    >
      <div className="speech-bubble" title={message.showYesNo ? undefined : 'Click to open Ash panel'}>
        {onClose && (
          <button
            type="button"
            className="speech-bubble-dismiss-btn"
            title="Dismiss bubble"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
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
            <div
              style={{ display: 'flex', gap: '8px', marginTop: '2px' }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="paper-btn-dark"
                style={{ flex: 1, padding: '7px 10px', fontSize: '9px' }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onYes) onYes()
                }}
              >
                YES
              </button>
              <button
                type="button"
                className="paper-btn-ghost"
                style={{ flex: 1, padding: '7px 10px', fontSize: '11px' }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onNo) onNo()
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
