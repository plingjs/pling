import { onMounted, ref, type Ref } from "vue";

/**
 * Public demos run on the Alibaba Cloud origin so chapter previews use the
 * mainland model gateway instead of the Cloudflare-hosted documentation edge.
 * Self-hosted documentation can override this at build time with
 * VITE_DEMO_ORIGIN.
 */
export const PUBLIC_DEMO_ORIGIN = (
  import.meta.env.VITE_DEMO_ORIGIN as string | undefined
)?.trim().replace(/\/$/, "") || "https://demo.plingjs.com";

function localDemoOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return undefined;
  if (window.location.port === "5191") return undefined;
  return `${window.location.protocol}//${window.location.hostname}:5191`;
}

/**
 * The first render keeps the production origin so static HTML and client
 * hydration agree. Local documentation then switches to the example server
 * after mount.
 */
export function useDemoOrigin(): Ref<string> {
  const origin = ref(PUBLIC_DEMO_ORIGIN);
  onMounted(() => {
    origin.value = localDemoOrigin() ?? PUBLIC_DEMO_ORIGIN;
  });
  return origin;
}
