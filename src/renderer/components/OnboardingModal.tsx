import React, { useState } from 'react'
import type { CompanionSettings } from '../types'
import { CompanionSprite } from './CompanionSprite'
import { sounds } from '../lib/sound'

interface OnboardingModalProps {
  isOpen: boolean
  initialSettings: CompanionSettings
  onComplete: (updates: Partial<CompanionSettings>) => void
}

type RhythmPreset = 'gentle' | 'balanced' | 'deep'

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialSettings,
  onComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState(initialSettings.userName || '')
  const [rhythm, setRhythm] = useState<RhythmPreset>('balanced')
  const [petScale, setPetScale] = useState(initialSettings.petScale || 165)
  const [typingAvoidance, setTypingAvoidance] = useState<CompanionSettings['typingAvoidance']>(
    initialSettings.typingAvoidance || 'high'
  )

  if (!isOpen) return null

  const applyRhythmValues = (preset: RhythmPreset) => {
    if (preset === 'gentle') {
      return { taskReminderMinutes: 20, waterIntervalMinutes: 30, eyeRestIntervalMinutes: 30 }
    }
    if (preset === 'deep') {
      return { taskReminderMinutes: 50, waterIntervalMinutes: 60, eyeRestIntervalMinutes: 60 }
    }
    return { taskReminderMinutes: 35, waterIntervalMinutes: 45, eyeRestIntervalMinutes: 45 }
  }

  const handleFinish = () => {
    sounds.playSuccess()
    const timing = applyRhythmValues(rhythm)
    onComplete({
      userName: name.trim() || 'Friend',
      onboardingCompleted: true,
      petScale,
      typingAvoidance,
      waterReminderEnabled: true,
      eyeRestEnabled: true,
      ...timing
    })
  }

  return (
    <div
      className="pixel-modal-backdrop"
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Ash"
    >
      <div className="pixel-modal" style={{ height: '480px', maxWidth: '500px' }}>
        <div className="modal-title-bar">
          <div className="modal-title">
            <span aria-hidden="true">🐾</span>
            <span>WELCOME TO ASH</span>
          </div>
          <span className="paper-section-label" style={{ position: 'absolute', right: '18px' }}>
            STEP {step} / 3
          </span>
        </div>

        <div className="modal-body" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '22px' }}>
          {step === 1 && (
            <>
              <CompanionSprite state="remind" scale={128} />
              <h2 className="paper-heading" style={{ fontSize: '15px' }}>
                WHAT SHOULD ASH CALL YOU?
              </h2>
              <p className="settings-desc" style={{ maxWidth: '340px' }}>
                Ash is your quiet desktop companion for tasks, water breaks, and breathing pauses.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sounds.playClick()
                  setStep(2)
                }}
                className="underline-input-row"
                style={{ width: '100%', maxWidth: '320px' }}
              >
                <input
                  type="text"
                  className="underline-input"
                  style={{ textAlign: 'center', fontSize: '16px' }}
                  placeholder="Enter your name..."
                  aria-label="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </form>
              <button
                type="button"
                className="paper-btn-dark"
                onClick={() => {
                  sounds.playClick()
                  setStep(2)
                }}
              >
                NEXT →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="paper-heading" style={{ fontSize: '14px' }}>
                HOW DO YOU LIKE TO WORK{name.trim() ? `, ${name.trim().toUpperCase()}` : ''}?
              </h2>
              <p className="settings-desc" style={{ maxWidth: '360px' }}>
                Choose how often Ash nudges you about pending tasks, water, and eye rest.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '380px' }}>
                {[
                  { id: 'balanced' as const, title: 'Balanced (Recommended)', desc: 'Tasks 35m • Water 45m • Eye rest 45m' },
                  { id: 'deep' as const, title: 'Deep Focus', desc: 'Tasks 50m • Water 60m • Eye rest 60m' },
                  { id: 'gentle' as const, title: 'Gentle Check-ins', desc: 'Tasks 20m • Water 30m • Eye rest 30m' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="settings-row"
                    style={{
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderColor: rhythm === opt.id ? 'var(--ink-primary)' : 'var(--paper-border)',
                      borderWidth: rhythm === opt.id ? '2px' : '1px',
                      background: rhythm === opt.id ? '#fff' : 'var(--paper-surface)'
                    }}
                    onClick={() => {
                      sounds.playClick()
                      setRhythm(opt.id)
                    }}
                  >
                    <div>
                      <div className="settings-label">{opt.title}</div>
                      <div className="settings-desc">{opt.desc}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--spirit-cyan)' }}>
                      {rhythm === opt.id ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="paper-btn-ghost" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="paper-btn-dark"
                  onClick={() => {
                    sounds.playClick()
                    setStep(3)
                  }}
                >
                  NEXT →
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <CompanionSprite state="idle" scale={Math.min(140, petScale)} />
              <h2 className="paper-heading" style={{ fontSize: '14px' }}>
                PICK ASH&apos;S SIZE &amp; BEHAVIOR
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '380px' }}>
                <div className="settings-row">
                  <div className="settings-label" style={{ marginBottom: 0 }}>Companion Size</div>
                  <div className="paper-pill-group">
                    {[
                      { label: 'S', value: 136 },
                      { label: 'M', value: 165 },
                      { label: 'L', value: 204 },
                      { label: 'XL', value: 238 }
                    ].map((sz) => (
                      <button
                        key={sz.value}
                        type="button"
                        className={`paper-pill ${petScale === sz.value ? 'active' : ''}`}
                        onClick={() => {
                          sounds.playClick()
                          setPetScale(sz.value)
                        }}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-row">
                  <div style={{ textAlign: 'left' }}>
                    <div className="settings-label">Fly away while typing</div>
                    <div className="settings-desc">Perches in a top corner out of your way</div>
                  </div>
                  <div className="paper-pill-group">
                    <button
                      type="button"
                      className={`paper-pill ${typingAvoidance !== 'off' ? 'active' : ''}`}
                      onClick={() => setTypingAvoidance('high')}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`paper-pill ${typingAvoidance === 'off' ? 'active' : ''}`}
                      onClick={() => setTypingAvoidance('off')}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="paper-btn-ghost" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <button type="button" className="paper-btn-dark" onClick={handleFinish}>
                  GET STARTED
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
