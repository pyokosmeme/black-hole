var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/oauth/login.js
async function onRequestPost(context) {
  const body = await context.request.json();
  const handle = body?.handle;
  if (!handle) {
    return jsonResponse({ error: "Handle required" }, 400);
  }
  try {
    const { did, pds } = await resolveHandle(handle);
    const authServer = await discoverAuthServer(pds);
    const { verifier, challenge } = await generatePkce();
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const [privateKeyJwk, publicKeyJwk] = await Promise.all([
      crypto.subtle.exportKey("jwk", keyPair.privateKey),
      crypto.subtle.exportKey("jwk", keyPair.publicKey)
    ]);
    const thumbprint = await jwkThumbprint(keyPair.publicKey);
    const state = crypto.randomUUID();
    const stateData = {
      codeVerifier: verifier,
      privateKeyJwk,
      publicKeyJwk,
      authServer,
      redirectUri: `${context.request.headers.get("origin") || "https://lastnpcalex.agency"}/api/oauth/callback`,
      handle,
      did,
      pds,
      createdAt: Date.now()
    };
    await context.env.SESSIONS.put(`state:${state}`, JSON.stringify(stateData), {
      expirationTtl: 900
    });
    const url = new URL("/oauth/authorize", authServer);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", stateData.redirectUri);
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("dpop_jkt", thumbprint);
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
var CLIENT_ID = "https://lastnpcalex.agency/client-metadata.json";
var SCOPE = "atproto";
var BSKY_PUBLIC = "https://public.api.bsky.app";
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64url, "base64url");
async function generatePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(hash));
  return { verifier, challenge };
}
__name(generatePkce, "generatePkce");
async function jwkThumbprint(publicKey) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  delete jwk.d;
  const canon = JSON.stringify(jwk, Object.keys(jwk).sort());
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return base64url(new Uint8Array(hash));
}
__name(jwkThumbprint, "jwkThumbprint");
async function resolveHandle(handle) {
  const res = await fetch(`${BSKY_PUBLIC}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error(`Handle resolution failed: ${res.status}`);
  const data = await res.json();
  const services = data.didDoc?.services || [];
  const atp = services.find((s) => s.type === "AtprotoPersistentHandle");
  return { did: data.did, pds: atp?.serviceEndpoint || "https://bsky.social" };
}
__name(resolveHandle, "resolveHandle");
async function discoverAuthServer(pds) {
  try {
    const res = await fetch(`${pds}/.well-known/oauth-authorization-server`);
    if (!res.ok) return "https://bsky.social";
    return (await res.json()).issuer;
  } catch {
    return "https://bsky.social";
  }
}
__name(discoverAuthServer, "discoverAuthServer");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://lastnpcalex.agency",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
__name(jsonResponse, "jsonResponse");

// api/bsky/createRecord.js
async function onRequest(context) {
  const session = await getSession(context);
  if (!session) return jsonResponse2({ error: "Not authenticated" }, 401);
  const { privateKey, publicKey } = await importKeyPair(session.privateKeyJwk, session.publicKeyJwk);
  const body = await context.request.json();
  const url = `${session.pds}/xrpc/com.atproto.repo.createRecord`;
  const dpopProof = await createDpopProof(privateKey, publicKey, "POST", url, session.accessToken);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DPoP ${session.accessToken}`,
      "DPoP": dpopProof
    },
    body: JSON.stringify({
      repo: session.did,
      collection: body.collection,
      rkey: body.rkey,
      record: body.record
    })
  });
  if (!res.ok) {
    const err = await res.text();
    return jsonResponse2({ error: err }, res.status);
  }
  return jsonResponse2(await res.json());
}
__name(onRequest, "onRequest");
function base64url2(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64url2, "base64url");
async function getSession(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const match2 = cookie.match(/session=([^;]+)/);
  if (!match2) return null;
  const raw = await context.env.SESSIONS.get(`session:${match2[1]}`);
  if (!raw) return null;
  return JSON.parse(raw);
}
__name(getSession, "getSession");
async function importKeyPair(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey("jwk", privateKeyJwk, { name: "ECDSA", hash: "SHA-256" }, true, ["sign"]),
    publicKey: await crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", hash: "SHA-256" }, true, ["verify"])
  };
}
__name(importKeyPair, "importKeyPair");
async function createDpopProof(privateKey, publicKey, method, url, accessToken) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  const header = { alg: "ES256", typ: "dpop+jwt", jwk };
  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 60,
    aud: new URL(url).origin,
    httptype: method,
    url
  };
  if (accessToken) {
    const ath = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
    payload.ath = base64url2(new Uint8Array(ath));
  }
  const h = base64url2(new TextEncoder().encode(JSON.stringify(header)));
  const p = base64url2(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(h + "." + p)
  );
  return h + "." + p + "." + base64url2(new Uint8Array(sig));
}
__name(createDpopProof, "createDpopProof");
function jsonResponse2(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://lastnpcalex.agency",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
__name(jsonResponse2, "jsonResponse");

// api/bsky/deleteRecord.js
async function onRequest2(context) {
  const session = await getSession2(context);
  if (!session) return jsonResponse3({ error: "Not authenticated" }, 401);
  const { privateKey, publicKey } = await importKeyPair2(session.privateKeyJwk, session.publicKeyJwk);
  const body = await context.request.json();
  const [, repo, collection, rkey] = body.uri.replace("at://", "").split("/");
  const url = `${session.pds}/xrpc/com.atproto.repo.deleteRecord`;
  const dpopProof = await createDpopProof2(privateKey, publicKey, "POST", url, session.accessToken);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DPoP ${session.accessToken}`,
      "DPoP": dpopProof
    },
    body: JSON.stringify({ repo, collection, rkey })
  });
  if (!res.ok) {
    const err = await res.text();
    return jsonResponse3({ error: err }, res.status);
  }
  return jsonResponse3({ deleted: true });
}
__name(onRequest2, "onRequest");
function base64url3(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64url3, "base64url");
async function getSession2(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const match2 = cookie.match(/session=([^;]+)/);
  if (!match2) return null;
  const raw = await context.env.SESSIONS.get(`session:${match2[1]}`);
  if (!raw) return null;
  return JSON.parse(raw);
}
__name(getSession2, "getSession");
async function importKeyPair2(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey("jwk", privateKeyJwk, { name: "ECDSA", hash: "SHA-256" }, true, ["sign"]),
    publicKey: await crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", hash: "SHA-256" }, true, ["verify"])
  };
}
__name(importKeyPair2, "importKeyPair");
async function createDpopProof2(privateKey, publicKey, method, url, accessToken) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  const header = { alg: "ES256", typ: "dpop+jwt", jwk };
  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 60,
    aud: new URL(url).origin,
    httptype: method,
    url
  };
  if (accessToken) {
    const ath = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
    payload.ath = base64url3(new Uint8Array(ath));
  }
  const h = base64url3(new TextEncoder().encode(JSON.stringify(header)));
  const p = base64url3(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(h + "." + p)
  );
  return h + "." + p + "." + base64url3(new Uint8Array(sig));
}
__name(createDpopProof2, "createDpopProof");
function jsonResponse3(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://lastnpcalex.agency",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
__name(jsonResponse3, "jsonResponse");

// api/oauth/callback.js
var CLIENT_ID2 = "https://lastnpcalex.agency/client-metadata.json";
var SESSION_MAX_AGE = 30 * 24 * 60 * 60;
var STATE_TTL = 15 * 60 * 1e3;
async function onRequest3(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) {
    const origin = new URL(context.request.url).origin;
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/test-bsky.html?auth_error=${encodeURIComponent(errorDescription || error)}` }
    });
  }
  if (!code || !state) {
    return jsonResponse4({ error: "Missing code or state" }, 400);
  }
  try {
    const stateRaw = await context.env.SESSIONS.get(`state:${state}`);
    if (!stateRaw) return jsonResponse4({ error: "Invalid state" }, 400);
    const stateData = JSON.parse(stateRaw);
    if (Date.now() - stateData.createdAt > STATE_TTL) {
      await context.env.SESSIONS.delete(`state:${state}`);
      return jsonResponse4({ error: "State expired" }, 400);
    }
    const { privateKey, publicKey } = await importKeyPair3(stateData.privateKeyJwk, stateData.publicKeyJwk);
    const tokenUrl = `${stateData.authServer}/oauth/token`;
    const dpopProof = await createDpopProof3(privateKey, publicKey, "POST", tokenUrl, null);
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: stateData.redirectUri,
      client_id: CLIENT_ID2,
      code_verifier: stateData.codeVerifier,
      dpop_jkt: await jwkThumbprint2(publicKey)
    });
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `DPoP ${dpopProof}`
      },
      body: tokenBody.toString()
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return jsonResponse4({ error: `Token exchange failed: ${err}` }, 500);
    }
    const tokenData = await tokenRes.json();
    await context.env.SESSIONS.delete(`state:${state}`);
    const sessionId = crypto.randomUUID();
    const sessionData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      did: stateData.did,
      handle: stateData.handle,
      pds: stateData.pds,
      authServer: stateData.authServer,
      privateKeyJwk: stateData.privateKeyJwk,
      publicKeyJwk: stateData.publicKeyJwk,
      createdAt: Date.now()
    };
    await context.env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_MAX_AGE
    });
    const origin = new URL(context.request.url).origin;
    const cookie = `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/test-bsky.html?logged_in=1`,
        "Set-Cookie": cookie
      }
    });
  } catch (e) {
    console.error("Callback error:", e);
    return jsonResponse4({ error: e.message }, 500);
  }
}
__name(onRequest3, "onRequest");
function base64url4(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64url4, "base64url");
async function importKeyPair3(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey("jwk", privateKeyJwk, { name: "ECDSA", hash: "SHA-256" }, true, ["sign"]),
    publicKey: await crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", hash: "SHA-256" }, true, ["verify"])
  };
}
__name(importKeyPair3, "importKeyPair");
async function jwkThumbprint2(publicKey) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  delete jwk.d;
  const canon = JSON.stringify(jwk, Object.keys(jwk).sort());
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return base64url4(new Uint8Array(hash));
}
__name(jwkThumbprint2, "jwkThumbprint");
async function createDpopProof3(privateKey, publicKey, method, url, accessToken) {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  const header = { alg: "ES256", typ: "dpop+jwt", jwk };
  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 60,
    aud: new URL(url).origin,
    httptype: method,
    url
  };
  if (accessToken) {
    const ath = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
    payload.ath = base64url4(new Uint8Array(ath));
  }
  const h = base64url4(new TextEncoder().encode(JSON.stringify(header)));
  const p = base64url4(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(h + "." + p)
  );
  return h + "." + p + "." + base64url4(new Uint8Array(sig));
}
__name(createDpopProof3, "createDpopProof");
function jsonResponse4(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://lastnpcalex.agency",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
__name(jsonResponse4, "jsonResponse");

// api/oauth/logout.js
async function onRequest4(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const match2 = cookie.match(/session=([^;]+)/);
  if (match2) {
    await context.env.SESSIONS.delete(`session:${match2[1]}`);
  }
  const clear = "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
  return new Response(JSON.stringify({ logged_out: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clear,
      "Access-Control-Allow-Origin": "https://lastnpcalex.agency",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
__name(onRequest4, "onRequest");

// api/oauth/session.js
async function onRequest5(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const match2 = cookie.match(/session=([^;]+)/);
  if (!match2) {
    return jsonResponse5({ error: "Not authenticated" }, 401);
  }
  const raw = await context.env.SESSIONS.get(`session:${match2[1]}`);
  if (!raw) return jsonResponse5({ error: "Session not found" }, 401);
  const session = JSON.parse(raw);
  return jsonResponse5({
    did: session.did,
    handle: session.handle,
    pds: session.pds,
    loggedInAt: session.createdAt
  });
}
__name(onRequest5, "onRequest");
function jsonResponse5(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://lastnpcalex.agency",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cookie",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
__name(jsonResponse5, "jsonResponse");

// ../.wrangler/tmp/pages-a1UIT6/functionsRoutes-0.8755819777201724.mjs
var routes = [
  {
    routePath: "/api/oauth/login",
    mountPath: "/api/oauth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/bsky/createRecord",
    mountPath: "/api/bsky",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/bsky/deleteRecord",
    mountPath: "/api/bsky",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/oauth/callback",
    mountPath: "/api/oauth",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/oauth/login",
    mountPath: "/api/oauth",
    method: "",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/oauth/logout",
    mountPath: "/api/oauth",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/oauth/session",
    mountPath: "/api/oauth",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  }
];

// ../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
