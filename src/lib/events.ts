import { track } from "./analytics";

// --- Standard funnel events (generated from EVENTS.yaml events map) ---

export function trackVisitLanding(props?: {
  variant?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  gclid?: string;
  click_id?: string;
}) {
  track("visit_landing", props);
}

export function trackCtaClick(props: { variant?: string; cta_text: string }) {
  track("cta_click", props);
}

export function trackSignupStart(props: { method: string }) {
  track("signup_start", props);
}

export function trackSignupComplete(props: { method: string }) {
  track("signup_complete", props);
}

export function trackSpecGenerated(props: {
  anonymous: boolean;
  idea_length: number;
  generation_time_ms: number;
}) {
  track("spec_generated", props);
}

export function trackExperimentCreated(props: {
  experiment_id: string;
  level: number;
}) {
  track("experiment_created", props);
}

export function trackActivate(props: {
  action: string;
  fake_door?: boolean;
}) {
  track("activate", props);
}

export function trackRetainReturn(props: { days_since_last: number }) {
  track("retain_return", props);
}

export function trackVerdictDelivered(props: {
  experiment_id: string;
  verdict: string;
  confidence: number;
}) {
  track("verdict_delivered", props);
}

export function trackDistributionLaunched(props: {
  experiment_id: string;
  channels: string;
}) {
  track("distribution_launched", props);
}

export function trackExperimentViewed(props: { experiment_id: string }) {
  track("experiment_viewed", props);
}

export function trackLabViewed(props: { experiment_count: number }) {
  track("lab_viewed", props);
}

export function trackChangeRequestSubmitted(props: {
  experiment_id: string;
  change_type: string;
}) {
  track("change_request_submitted", props);
}

// --- Payment events (requires: [payment] in EVENTS.yaml; stack.payment: stripe) ---

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

export function trackCheckoutStarted(props: {
  plan: string;
  amount_cents: number;
}) {
  track("checkout_started", props);
}

export function trackPaymentComplete(props: {
  plan: string;
  amount_cents: number;
  provider: string;
}) {
  track("payment_complete", props);
}
