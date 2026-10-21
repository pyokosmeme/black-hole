// Shared by both Worker session readers. Older sessions were not identity-validated.
export const AUTH_SESSION_VERSION = 2;

export function oauthUrl(value, { originOnly = false } = {}) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid OAuth URL');
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  // Only HTTPS DNS names on the default port. Literal addresses (including
  // URL-normalized decimal/hex IPv4), local names, credentials and fragments
  // are never valid discovery or credential destinations for this client.
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash ||
      !host.includes('.') || host.endsWith('.') || /^[\d.]+$/.test(host) || host.includes(':') ||
      !/^[a-z0-9.-]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host) ||
      host.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new Error('Unsafe OAuth URL');
  }
  if (originOnly && (url.pathname !== '/' || url.search)) throw new Error('Expected an OAuth server origin');
  return originOnly ? url.origin : url.href;
}

export async function oauthFetch(url, init = {}) {
  // Workers native fetch owns DNS/network routing and TLS verification. Never
  // follow a redirect with a code verifier, refresh token or DPoP proof.
  const response = await fetch(oauthUrl(url), {
    ...init, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error('OAuth redirect refused');
  return response;
}

export async function oauthText(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128_000) throw new Error('OAuth response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function oauthJson(url) {
  const response = await oauthFetch(url);
  if (!response.ok) throw new Error('OAuth discovery failed');
  return JSON.parse(await oauthText(response));
}

export function grantedScope(data, expectedDid, requestedScope) {
  if (data?.sub !== expectedDid || typeof data.access_token !== 'string' || !data.access_token ||
      String(data.token_type).toLowerCase() !== 'dpop' || typeof data.scope !== 'string') {
    throw new Error('Invalid OAuth token identity or type');
  }
  const scopes = [...new Set(data.scope.split(/\s+/).filter(Boolean))];
  const requested = new Set(String(requestedScope).split(/\s+/));
  if (!scopes.includes('atproto') || scopes.some(scope => !requested.has(scope))) {
    throw new Error('Invalid OAuth grant');
  }
  return scopes.join(' ');
}
