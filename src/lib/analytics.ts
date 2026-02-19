import posthog from "posthog-js";

const PROJECT_NAME = "silicon-coliseum";
const PROJECT_OWNER = "quanpeng";

let initialized = false;

function init() {
  if (initialized || typeof window === "undefined") return;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false,
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
