function paramsContainOauthResponse(params: URLSearchParams): boolean {
  return (
    params.has("code") ||
    params.has("state") ||
    params.has("error") ||
    params.has("id_token") ||
    params.has("token")
  );
}

function parseHashParams(): URLSearchParams {
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (rawHash === "") {
    return new URLSearchParams();
  }

  const candidates: string[] = [];

  // Most common form: #code=...&state=...
  candidates.push(rawHash);

  // Common SPA callback forms: #/auth/callback?code=...&state=... or #/?code=...
  const questionIndex = rawHash.indexOf("?");
  if (questionIndex >= 0 && questionIndex < rawHash.length - 1) {
    candidates.push(rawHash.slice(questionIndex + 1));
  }
  if (rawHash.startsWith("/?")) {
    candidates.push(rawHash.slice(2));
  }
  if (rawHash.startsWith("?")) {
    candidates.push(rawHash.slice(1));
  }
  if (rawHash.startsWith("/")) {
    candidates.push(rawHash.slice(1));
  }

  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate);
    if (paramsContainOauthResponse(params)) {
      return params;
    }
  }

  return new URLSearchParams();
}

export function hasOauthResponseInLocation(): boolean {
  const searchParams = new URLSearchParams(window.location.search);
  if (paramsContainOauthResponse(searchParams)) {
    return true;
  }

  const hashParams = parseHashParams();
  return paramsContainOauthResponse(hashParams);
}

/**
 * Some OAuth providers / reverse proxy setups may return callback params in the hash
 * fragment. OSDK reads query params from the URL object, so we normalize hash params
 * into search params before calling signIn().
 */
export function normalizeOauthResponseFromHash(): void {
  const hashParams = parseHashParams();
  if (!paramsContainOauthResponse(hashParams)) {
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);
  for (const [key, value] of hashParams.entries()) {
    if (!searchParams.has(key)) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  const nextUrl = query === ""
    ? window.location.pathname
    : `${window.location.pathname}?${query}`;

  window.history.replaceState({}, "", nextUrl);
}
