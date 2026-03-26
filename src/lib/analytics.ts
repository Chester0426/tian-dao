import posthog from "posthog-js";

const PROJECT_NAME = "xian-idle";
const PROJECT_OWNER = "Chester0426";
const POSTHOG_KEY = "phc_9pSomMlHylLB9GXolTGMZ9jZJnITRwNaJacJLkKA8rY";
const POSTHOG_HOST = "/ingest";

let initialized = false;

function init() {
  if (initialized || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_exceptions: true,
    disable_compression: true, // Force XHR for Playwright route interception
  });
  initialized = true;
}

export function track(event: string, properties?: Record<string, unknown>) {
  init();
  posthog.capture(event, {
    ...properties,
    project_name: PROJECT_NAME,
    project_owner: PROJECT_OWNER,
  });
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  init();
  posthog.identify(userId, traits);
}

export function reset() {
  init();
  posthog.reset();
}
