import { useState, useCallback, useEffect } from 'react'
import { X, Database, Copy, ExternalLink, Check } from 'lucide-react'
import { validateSupabaseCreds, type ValidatedSupabaseCreds, type ValidationResult } from '../lib/byoSupabaseValidation'

interface ConnectBackendModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onConnected: (creds: ValidatedSupabaseCreds) => void
}

const AUTH_PRESET_SQL = `-- Mokkoi Auth Preset
-- Run this in your Supabase SQL Editor before logging in from your app
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
`

export function ConnectBackendModal({ projectId: _projectId, isOpen, onClose, onConnected }: ConnectBackendModalProps) {
  const [step, setStep] = useState<'creds' | 'sql'>('creds')
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [error, setError] = useState<ValidationResult | null>(null)
  const [validated, setValidated] = useState<ValidatedSupabaseCreds | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset state when the modal closes so a re-open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setStep('creds')
      setUrl('')
      setAnonKey('')
      setError(null)
      setValidated(null)
      setCopied(false)
    }
  }, [isOpen])

  const handleConnect = useCallback(() => {
    const result = validateSupabaseCreds(url, anonKey)
    if (!result.ok) {
      setError(result)
      return
    }
    setError(null)
    setValidated(result.creds)
    setStep('sql')
  }, [url, anonKey])

  const handleCopySql = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AUTH_PRESET_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[ConnectBackendModal] clipboard write failed', err)
    }
  }, [])

  const handleConfirm = useCallback(() => {
    if (validated) {
      onConnected(validated)
      onClose()
    }
  }, [validated, onConnected, onClose])

  if (!isOpen) return null

  const submitDisabled = !url.trim() || !anonKey.trim()

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: '#1A1A1A',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          color: '#e2e8f0',
          overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={18} color="rgba(45, 212, 191, 0.9)" />
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {step === 'creds' ? 'Connect Backend' : 'Run the auth preset'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: '#94a3b8',
              cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          ><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
          {step === 'creds' && (
            <>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>
                Paste your Supabase project's URL and anon (public) key. Mokkoi will bundle them
                with the exported app so authentication, database, and storage work in your preview.
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#cbd5e1', marginBottom: 6 }}>
                Supabase URL
              </label>
              <input
                type="url"
                name="supabase-project-url"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-bwignore="true"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(null) }}
                placeholder="https://your-project-ref.supabase.co"
                style={inputStyle(error?.ok === false && error.code === 'invalid_url')}
              />
              {error?.ok === false && error.code === 'invalid_url' && (
                <div style={inlineErrorStyle}>{error.message}</div>
              )}

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#cbd5e1', marginTop: 14, marginBottom: 6 }}>
                Anon key (public)
              </label>
              <input
                type="text"
                name="supabase-anon-key"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-bwignore="true"
                value={anonKey}
                onChange={e => { setAnonKey(e.target.value); setError(null) }}
                placeholder="eyJhbGciOi..."
                style={{ ...inputStyle(error?.ok === false && error.code === 'invalid_key_format'), fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
              />
              {error?.ok === false && error.code === 'invalid_key_format' && (
                <div style={inlineErrorStyle}>{error.message}</div>
              )}

              {error?.ok === false && error.code === 'service_role_rejected' && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: '#fecaca' }}>
                    Service-role key detected — refusing
                  </div>
                  <div>{error.message}</div>
                  <a
                    href="https://supabase.com/docs/guides/api/api-keys"
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                      color: '#fca5a5', textDecoration: 'underline', fontSize: 12,
                    }}
                  >
                    Where to find your anon key <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </>
          )}

          {step === 'sql' && (
            <>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 1.5 }}>
                Almost done. Open your Supabase Dashboard → SQL Editor and run this preset to
                create the <code style={{ color: '#cbd5e1' }}>profiles</code> table and auth trigger
                that the exported app expects.
              </div>

              <div style={{
                position: 'relative',
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 12,
                color: '#cbd5e1',
                maxHeight: 280, overflow: 'auto',
              }}>
                <pre style={{ margin: 0, padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {AUTH_PRESET_SQL}
                </pre>
                <button
                  onClick={handleCopySql}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6,
                    background: 'rgba(45, 212, 191, 0.12)',
                    border: '1px solid rgba(45, 212, 191, 0.3)',
                    color: 'rgba(45, 212, 191, 0.95)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy SQL</>}
                </button>
              </div>

              <div style={{ fontSize: 12, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
                Paste this in <strong style={{ color: '#94a3b8' }}>Supabase Dashboard → SQL Editor → New query → Run</strong>.
                Once it succeeds, click below to save the connection.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Free tier: 1 connected project. Upgrade for unlimited.
          </div>
          {step === 'creds' ? (
            <button
              onClick={handleConnect}
              disabled={submitDisabled}
              style={primaryButtonStyle(submitDisabled)}
            >Connect</button>
          ) : (
            <button
              onClick={handleConfirm}
              style={primaryButtonStyle(false)}
            >I've run this</button>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '9px 12px',
  background: '#0d1117',
  border: hasError ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
})

const inlineErrorStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: '#fca5a5',
  lineHeight: 1.4,
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: 8,
  background: disabled ? 'rgba(45, 212, 191, 0.2)' : 'rgba(45, 212, 191, 0.95)',
  border: 'none',
  color: disabled ? 'rgba(255,255,255,0.5)' : '#0a0a0a',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'background 0.15s',
})
