import { useState, useEffect } from 'react'
import { X, Check, Link2, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ShareModalProps {
  projectId: string
  projectName: string
  isOpen: boolean
  onClose: () => void
}

export function ShareModal({ projectId, projectName, isOpen, onClose }: ShareModalProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/view/${projectId}`
  const shareText = `Check out my design: ${projectName}`

  // Load current is_public state
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    supabase
      .from('projects')
      .select('is_public')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        setIsPublic(data?.is_public ?? false)
        setLoading(false)
      })
  }, [isOpen, projectId])

  const togglePublic = async () => {
    const newVal = !isPublic
    setIsPublic(newVal)
    await supabase
      .from('projects')
      .update({ is_public: newVal })
      .eq('id', projectId)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  const socialButtons = [
    {
      label: 'WhatsApp',
      color: '#25D366',
      letter: 'W',
      href: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    },
    {
      label: 'Telegram',
      color: '#2AABEE',
      letter: 'T',
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      label: 'X',
      color: '#fff',
      letter: '𝕏',
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Check out my design on Mokkoi')}`,
    },
    {
      label: 'LinkedIn',
      color: '#0A66C2',
      letter: 'in',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'Email',
      color: '#94a3b8',
      letter: null,
      href: `mailto:?subject=${encodeURIComponent('Check out my Mokkoi design')}&body=${encodeURIComponent(shareUrl)}`,
    },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1A1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          width: '100%', maxWidth: 480,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>Share project</h2>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: '#94a3b8', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toggle row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
            Enable sharing and remixing
          </span>
          <button
            onClick={togglePublic}
            disabled={loading}
            style={{
              width: 44, height: 24, borderRadius: 12, padding: 2,
              background: isPublic ? '#6366f1' : 'rgba(255,255,255,0.1)',
              border: 'none', cursor: loading ? 'wait' : 'pointer',
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center',
              justifyContent: isPublic ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff',
              transition: 'all 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>

        {/* Status text */}
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
          {isPublic
            ? 'Anyone with the link can view this project'
            : 'Only you can access this project'}
        </p>

        {/* Public sharing details */}
        {isPublic && (
          <>
            {/* Link field */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
            }}>
              <input
                readOnly
                value={shareUrl}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13,
                  outline: 'none',
                }}
                onClick={e => (e.target as HTMLInputElement).select()}
              />
            </div>

            {/* Copy link button */}
            <button
              onClick={copyLink}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.12)',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.25)'}`,
                color: copied ? '#34d399' : '#818cf8',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                marginBottom: 20,
              }}
              onMouseEnter={e => {
                if (!copied) {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.2)'
                }
              }}
              onMouseLeave={e => {
                if (!copied) {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                }
              }}
            >
              {copied ? <Check size={16} /> : <Link2 size={16} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>

            {/* Social share buttons */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, marginBottom: 20,
            }}>
              {socialButtons.map(btn => (
                <a
                  key={btn.label}
                  href={btn.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Share on ${btn.label}`}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: btn.color,
                    fontSize: btn.label === 'LinkedIn' ? 12 : 16,
                    fontWeight: 800,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {btn.letter === null ? <Mail size={18} /> : btn.letter}
                </a>
              ))}
            </div>

            {/* Info text */}
            <p style={{
              margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.5,
              textAlign: 'center',
            }}>
              By making your project public, you allow anyone with the link to view your designs and code. You can revoke access at any time.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
