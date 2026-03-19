import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialized = false

export function initAnalytics() {
  if (POSTHOG_KEY && !initialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.debug()
      },
      capture_pageview: true,
      capture_pageleave: true,
    })
    initialized = true
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (initialized) posthog.capture(event, properties)
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (initialized) posthog.identify(userId, traits)
}

export function resetAnalytics() {
  if (initialized) posthog.reset()
}
