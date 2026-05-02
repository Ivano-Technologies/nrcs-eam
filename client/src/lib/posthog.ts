import posthog from 'posthog-js'

export function initPostHog() {
  if (import.meta.env.VITE_ENV !== 'production') return

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    person_profiles: 'never',
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    },
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.opt_out_capturing()
    },
  })
}

export function identifyUser(userId: string, role: string, facilityCode: string) {
  if (import.meta.env.VITE_ENV !== 'production') return
  posthog.identify(userId, { role, facilityCode })
}

export function resetPostHog() {
  posthog.reset()
}