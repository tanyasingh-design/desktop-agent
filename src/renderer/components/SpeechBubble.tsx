import React, { useState, useEffect } from 'react'
import type { BubbleMessage } from '../types'

interface SpeechBubbleProps {
  message: BubbleMessage | null
  onClose?: () => void
  onAction?: (actionData?: string) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  message,
  onClose,
  onAction,
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

  return (
    <div
      className="speech-bubble-bridge"
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
          {message.actionLabel && (
            <button
              type="button"
              className="pixel-btn"
              style={{
                fontSize: '9px',
                padding: '4px 8px',
                marginTop: '3px',
                width: '100%',
                justifyContent: 'center'
              }}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                handleTrigger(e)
              }}
              onClick={handleTrigger}
            >
              {message.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
