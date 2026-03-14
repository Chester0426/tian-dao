import { track } from "./analytics";

// --- Standard funnel events (generated from EVENTS.yaml events map) ---

export function trackVisitLanding(props?: {
  variant?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
  click_id?: string;
  utm_content?: string;
}) {
  track("visit_landing", props);
}

export function trackSignupStart(props: { method: string }) {
  track("signup_start", props);
}

export function trackSignupComplete(props: { method: string }) {
  track("signup_complete", props);
}

export function trackActivate(props: { action: string; fake_door?: boolean }) {
  track("activate", props);
}

export function trackRetainReturn(props: { days_since_last: number }) {
  track("retain_return", props);
}

// --- Payment events (requires: [payment] in EVENTS.yaml, stack.payment: stripe present) ---

export function trackPayStart(props: { plan: string; amount_cents: number }) {
  track("pay_start", props);
}

export function trackPaySuccess(props: {
  plan: string;
  amount_cents: number;
  provider: string;
}) {
  track("pay_success", props);
}

// --- Assayer custom events (from EVENTS.yaml custom events) ---

export function trackCtaClick(props?: { variant?: string }) {
  track("cta_click", props);
}

export function trackSpecGenerated(props: {
  anonymous: boolean;
  idea_length?: number;
  generation_time_ms?: number;
}) {
  track("spec_generated", props);
}

export function trackExperimentCreated() {
  track("experiment_created");
}

export function trackExperimentViewed(props: { experiment_id: string }) {
  track("experiment_viewed", props);
}

export function trackVerdictDelivered(props: {
  experiment_id: string;
  verdict: string;
}) {
  track("verdict_delivered", props);
}

export function trackLabViewed() {
  track("lab_viewed");
}
