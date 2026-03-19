import { createClient, type Client } from "@osdk/client";
import {
  createPublicOauthClient,
  type PublicOauthClient,
} from "@osdk/oauth";
import { $ontologyRid } from "@god/sdk";

function getMetaTagContent(tagName: string): string {
  const elements = document.querySelectorAll(`meta[name="${tagName}"]`);
  const element = elements.item(elements.length - 1);
  const value = element?.getAttribute("content");

  if (value == null || value === "") {
    throw new Error(`Meta tag ${tagName} not found or empty`);
  }

  if (value.match(/%.+%/)) {
    throw new Error(
      `Meta tag ${tagName} contains placeholder value. Please add ${value.replace(
        /%/g,
        "",
      )} to your .env files`,
    );
  }

  return value;
}

function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }

  return new URL(url, window.location.origin).toString();
}

const configuredFoundryUrl = toAbsoluteUrl(getMetaTagContent("osdk-foundryUrl"));
const proxyTarget = import.meta.env.VITE_FOUNDRY_PROXY_TARGET as string | undefined;
const useDirectFoundryForAuth =
  import.meta.env.DEV &&
  proxyTarget != null &&
  proxyTarget !== "" &&
  configuredFoundryUrl.startsWith(window.location.origin);
const stackUrl = useDirectFoundryForAuth ? proxyTarget : configuredFoundryUrl;
const clientId = getMetaTagContent("osdk-clientId");
const redirectUrl = getMetaTagContent("osdk-redirectUrl");
const oauthStorageKey = `@osdk/oauth : refresh : ${clientId}`;
const oauthStoragePrefix = "@osdk/oauth";

const scopes = [
  "api:use-ontologies-read",
  "api:use-ontologies-write",
  "api:use-datasets-read",
  "api:use-datasets-write",
  "api:use-mediasets-read",
  "api:use-mediasets-write",
];

export const auth = createPublicOauthClient(clientId, stackUrl, redirectUrl, {
  scopes,
});

export type AppClient = Client & { auth: PublicOauthClient };

function shouldProxyRequest(url: URL): boolean {
  if (!import.meta.env.DEV || !useDirectFoundryForAuth) {
    return false;
  }
  if (url.origin !== new URL(stackUrl).origin) {
    return false;
  }

  return (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/v2") ||
    url.pathname.startsWith("/ontology-metadata")
  );
}

const browserFetch: typeof fetch = async (input, init) => {
  const rawUrl =
    typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const resolved = new URL(rawUrl, window.location.origin);

  if (!shouldProxyRequest(resolved)) {
    return await fetch(input as RequestInfo | URL, init);
  }

  const proxyUrl = new URL(
    `${resolved.pathname}${resolved.search}`,
    window.location.origin,
  ).toString();

  if (input instanceof Request) {
    const proxiedRequest = new Request(proxyUrl, input);
    return await fetch(proxiedRequest, init);
  }

  return await fetch(proxyUrl, init);
};

const client: AppClient = Object.assign(
  createClient(stackUrl, $ontologyRid, auth, undefined, browserFetch),
  {
  auth,
  },
);

function clearStorageByPrefix(storage: Storage, prefix: string): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key != null && key.includes(prefix)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

export function clearOauthStorage(): void {
  localStorage.removeItem(oauthStorageKey);
  sessionStorage.removeItem(oauthStorageKey);
  clearStorageByPrefix(localStorage, oauthStoragePrefix);
  clearStorageByPrefix(sessionStorage, oauthStoragePrefix);
}

export function clearOauthSessionStorage(): void {
  sessionStorage.removeItem(oauthStorageKey);
  clearStorageByPrefix(sessionStorage, oauthStoragePrefix);
}

export default client;
