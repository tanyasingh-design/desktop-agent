import React from 'react'
import type { BubbleMessage } from '../types'

interface SpeechBubbleProps {
  message: BubbleMessage | null
  onClose: () => void
  onAction?: (actionData?: string) => void
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ message, onClose, onAction }) => {
  if (!message) return null

  return (
    <div className="speech-bubble" onClick={(e) => e.stopPropagation()}>
      <div className="speech-bubble-inner">
        <span>{message.text}</span>
        {message.actionLabel && (
          <button
            className="pixel-btn"
            style={{ fontSize: '9px', padding: '4px 8px', marginTop: '4px' }}
            onClick={() => onAction && onAction(message.actionData)}
          >
            {message.actionLabel}
          </button>
        )}
        <div className="speech-bubble-close" onClick={onClose}>
          [dismiss]
        </div>
      </div>
    </div>
  )
}
