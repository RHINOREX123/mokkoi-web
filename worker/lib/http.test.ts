import { describe, expect, it } from 'vitest'
import { PolicyError, SafeHttp, hostAllowed, isPrivateAddress, redactUrl } from './http.js'

describe('Level 0 network policy', () => {
  const http = new SafeHttp({ targetDomains: ['example.com'] })

  it('blocks every method except GET and HEAD', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'post']) expect(() => SafeHttp.assertMethod(m)).toThrow(PolicyError)
    expect(() => SafeHttp.assertMethod('GET')).not.toThrow()
    expect(() => SafeHttp.assertMethod('HEAD')).not.toThrow()
  })

  it('refuses a non-GET request before any network access', async () => {
    await expect(http.get('https://example.com/', { method: 'POST' as 'GET' })).rejects.toThrow(PolicyError)
  })

  it('refuses hosts outside the allow-list', async () => {
    await expect(http.get('https://evil.test/')).rejects.toThrow(/allow-list/)
    await expect(http.get('https://example.com.evil.test/')).rejects.toThrow(/allow-list/)
  })

  it('refuses private addresses, odd ports, credentials and non-http schemes', async () => {
    await expect(http.get('http://127.0.0.1/')).rejects.toThrow(/private/)
    await expect(http.get('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/private/)
    await expect(http.get('https://example.com:8443/')).rejects.toThrow(/port/)
    await expect(http.get('https://user:pw@example.com/')).rejects.toThrow(/credentials/)
    await expect(http.get('file:///etc/passwd')).rejects.toThrow(/scheme/)
  })

  it('logs refused requests', async () => {
    const h = new SafeHttp({ targetDomains: ['example.com'] })
    await h.get('https://nope.test/').catch(() => undefined)
    expect(h.log).toHaveLength(1)
    expect(h.log[0].error).toMatch(/allow-list/)
  })

  it('matches subdomains of allowed domains only', () => {
    expect(hostAllowed('api.example.com', ['example.com'])).toBe(true)
    expect(hostAllowed('example.com', ['example.com'])).toBe(true)
    expect(hostAllowed('badexample.com', ['example.com'])).toBe(false)
  })

  it('classifies private and public addresses', () => {
    for (const ip of ['10.0.0.1', '172.16.5.4', '192.168.1.1', '127.0.0.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) expect(isPrivateAddress(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '95.85.57.13', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false)
  })

  it('redacts API keys from logged URLs', () => {
    expect(redactUrl('https://www.googleapis.com/x?url=a&key=SECRET123')).toBe('https://www.googleapis.com/x?url=a&key=REDACTED')
  })
})
