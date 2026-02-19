import { PostHog } from "posthog-node";

const PROJECT_NAME = "silicon-coliseum";
const PROJECT_OWNER = "quanpeng";

export async function trackServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });

  client.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      project_name: PROJECT_NAME,
      project_owner: PROJECT_OWNER,
    },
  });

  await client.shutdown();
}
