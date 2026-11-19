import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import test from "node:test";
import worker, { handleRequest } from "../src/index.js";

globalThis.crypto ??= webcrypto;

const oauthOrigin = "https://ocarina-cms-auth.test-account.workers.dev";
const env = {
  CMS_ORIGIN: "https://oliver492.github.io",
  OAUTH_ORIGIN: oauthOrigin,
  ALLOWED_GITHUB_USER: "oliver492",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
};
const cookieName = "__Host-ocarina-cms-oauth";
const request = (path, cookie) => new Request(`${oauthOrigin}${path}`, {
  headers: cookie ? { Cookie: cookie } : {},
});
const encode = (value) => Buffer.from(value).toString("base64url");

async function startLogin(extraQuery = "") {
  const result = await handleRequest(request(`/auth?provider=github&site_id=oliver492.github.io${extraQuery}`), env);
  assert.equal(result.status, 302);
  const cookie = result.headers.get("Set-Cookie").split(";")[0];
  const session = JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[0], "base64url"));
  return { result, cookie, session, authorize: new URL(result.headers.get("Location")) };
}

async function signedCookie(session) {
  const data = encode(JSON.stringify(session));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.GITHUB_CLIENT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${cookieName}=${data}.${encode(signature)}`;
}

function assertCleared(result) {
  const cookie = result.headers.get("Set-Cookie");
  assert.match(cookie, new RegExp(`^${cookieName}=`));
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
}

function callback(session, cookie, query = `code=valid-code&state=${session.state}`) {
  return request(`/callback?${query}`, cookie);
}

function githubFetch({ token = "test-access-token", login = "oliver492", tokenStatus = 200, userStatus = 200, tokenData, userData } = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === "https://github.com/login/oauth/access_token") {
        return Response.json(tokenData ?? { access_token: token, token_type: "bearer", scope: "public_repo" }, { status: tokenStatus });
      }
      assert.equal(url, "https://api.github.com/user");
      return Response.json(userData ?? { login }, { status: userStatus });
    },
  };
}

function runPopup(html) {
  const listeners = new Map();
  const sent = [];
  const opener = { postMessage: (data, targetOrigin) => sent.push({ data, targetOrigin }) };
  const window = {
    opener,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const script = html.match(/<script nonce="([^"]+)">([\s\S]+?)<\/script>/);
  assert.ok(script);
  runInNewContext(script[2], { window });
  return {
    nonce: script[1], sent, opener, listeners,
    dispatch: (event) => listeners.get("message")?.(event),
  };
}

test("health reports readiness without exposing configuration", async () => {
  for (const settings of [{}, { ...env, GITHUB_CLIENT_SECRET: undefined }, { ...env, OAUTH_ORIGIN: "https://ocarina-cms-auth.replace-with-your-subdomain.workers.dev" }]) {
    const result = await handleRequest(request("/health"), settings);
    assert.equal(result.status, 200);
    assert.equal(await result.text(), '{"ready":false}');
  }
  const ready = await worker.fetch(request("/health"), env, { notAFetchFunction: true });
  assert.deepEqual(await ready.json(), { ready: true });
});

test("literal undefined and null credentials fail closed regardless of letter case", async () => {
  for (const field of ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]) {
    for (const value of ["undefined", "Undefined", "UNDEFINED", "uNdEfInEd", "null", "Null", "NULL", "nUlL"]) {
      const settings = { ...env, [field]: value };
      const description = `${field}=${value}`;
      const health = await handleRequest(request("/health"), settings);
      assert.equal(health.status, 200, description);
      assert.equal(await health.text(), '{"ready":false}', description);
      const auth = await handleRequest(request("/auth?provider=github"), settings, () => assert.fail("invalid credentials must not reach GitHub"));
      assert.equal(auth.status, 503, description);
      assert.equal(auth.headers.get("Location"), null, description);
      assertCleared(auth);
      const body = await auth.text();
      assert.match(body, new RegExp(field), description);
      const otherField = field === "GITHUB_CLIENT_ID" ? "GITHUB_CLIENT_SECRET" : "GITHUB_CLIENT_ID";
      assert.doesNotMatch(body, new RegExp(otherField), description);
      const output = `${body} ${JSON.stringify([...auth.headers])}`;
      assert.doesNotMatch(output, /undefined|null|test-client|oliver492|workers\.dev/i, description);
    }
  }
});

test("missing origins keep the generic auth message and opaque health response", async () => {
  for (const settings of [
    { ...env, CMS_ORIGIN: undefined },
    { ...env, OAUTH_ORIGIN: undefined },
    { ...env, CMS_ORIGIN: "not-an-origin" },
  ]) {
    const health = await handleRequest(request("/health"), settings);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), '{"ready":false}');
    const auth = await handleRequest(request("/auth?provider=github"), settings);
    assert.equal(auth.status, 503);
    assert.equal(auth.headers.get("Location"), null);
    assertCleared(auth);
    assert.equal(await auth.text(), "登录代理尚未配置完成。");
  }
});

test("auth fails closed when credentials or exact HTTPS origins are missing", async () => {
  for (const settings of [{}, { ...env, GITHUB_CLIENT_SECRET: "" }, { ...env, CMS_ORIGIN: "https://oliver492.github.io/ocarina/" }, { ...env, CMS_ORIGIN: "http://oliver492.github.io" }, { ...env, OAUTH_ORIGIN: `${oauthOrigin}/` }]) {
    const result = await handleRequest(request("/auth?provider=github"), settings);
    assert.equal(result.status, 503);
    assertCleared(result);
    assert.doesNotMatch(await result.text(), /test-client/);
  }
  for (const url of ["http://ocarina-cms-auth.test-account.workers.dev/auth?provider=github", "https://evil.example/auth?provider=github"]) {
    const result = await handleRequest(new Request(url), env);
    assert.equal(result.status, 400);
    assert.equal(result.headers.get("Location"), null);
  }
});

test("auth fixes callback and public_repo scope and binds a 32-byte state and S256 PKCE", async () => {
  const { result, authorize, session } = await startLogin("&scope=repo%20user%20workflow&redirect_uri=https://evil.example");
  assert.equal(authorize.origin, "https://github.com");
  assert.equal(authorize.pathname, "/login/oauth/authorize");
  assert.equal(authorize.searchParams.get("client_id"), env.GITHUB_CLIENT_ID);
  assert.equal(authorize.searchParams.get("redirect_uri"), `${oauthOrigin}/callback`);
  assert.equal(authorize.searchParams.get("scope"), "public_repo");
  assert.equal(authorize.searchParams.get("login"), "oliver492");
  assert.equal(authorize.searchParams.get("allow_signup"), "false");
  assert.equal(Buffer.from(session.state, "base64url").length, 32);
  assert.equal(Buffer.from(session.verifier, "base64url").length, 32);
  assert.equal(authorize.searchParams.get("state"), session.state);
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorize.searchParams.get("code_challenge"), encode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session.verifier))));
  assert.notEqual(session.state, session.verifier);
  assert.equal(session.origin, oauthOrigin);
  const cookie = result.headers.get("Set-Cookie");
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=600$/);
  assert.doesNotMatch(cookie, /Domain=|test-client-secret/);
  assert.doesNotMatch(authorize.href, /test-client-secret|code_verifier/);
});

test("auth rejects another provider and an untrusted site id", async () => {
  for (const query of ["provider=gitlab", "provider=github&site_id=evil.example"]) {
    const result = await handleRequest(request(`/auth?${query}`), env);
    assert.equal(result.status, 400);
    assert.equal(result.headers.get("Location"), null);
    assertCleared(result);
  }
});

test("callback rejects missing, malformed, tampered, stale and future sessions before making requests", async () => {
  const { cookie, session } = await startLogin();
  const stale = await signedCookie({ ...session, issuedAt: Date.now() - 601000 });
  const future = await signedCookie({ ...session, issuedAt: Date.now() + 60000 });
  const wrongOrigin = await signedCookie({ ...session, origin: "https://evil.example" });
  const cases = [
    callback(session),
    callback(session, `${cookieName}=not-a-session`),
    callback(session, `${cookie}tampered`),
    callback(session, `${cookie}; ${cookie}`),
    callback(session, stale),
    callback(session, future),
    callback(session, wrongOrigin),
    callback(session, cookie, "code=valid-code"),
    callback(session, cookie, "code=valid-code&state=wrong"),
    callback(session, cookie, `code=valid-code&state=${session.state}&state=${session.state}`),
  ];
  for (const input of cases) {
    const result = await handleRequest(input, env, () => assert.fail("invalid state must not reach GitHub"));
    assert.equal(result.status, 400);
    assertCleared(result);
    assert.match(await result.text(), /authorization:github:error:/);
  }
});

test("callback handles denied authorization and missing or duplicate code without token exchange", async () => {
  const { cookie, session } = await startLogin();
  for (const query of [`error=access_denied&error_description=secret-detail&state=${session.state}`, `state=${session.state}`, `code=one&code=two&state=${session.state}`]) {
    const result = await handleRequest(callback(session, cookie, query), env, () => assert.fail("invalid code must not reach GitHub"));
    assert.equal(result.status, 400);
    assertCleared(result);
    assert.doesNotMatch(await result.text(), /secret-detail/);
  }
});

test("callback supplies PKCE and secret only to GitHub and verifies the allowed account", async () => {
  const { cookie, session } = await startLogin();
  const github = githubFetch();
  const result = await handleRequest(callback(session, cookie), env, github.fetch);
  assert.equal(result.status, 200);
  assertCleared(result);
  assert.equal(github.calls.length, 2);
  assert.deepEqual(JSON.parse(github.calls[0].options.body), {
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code: "valid-code",
    redirect_uri: `${oauthOrigin}/callback`,
    code_verifier: session.verifier,
  });
  assert.equal(github.calls[0].options.redirect, "error");
  assert.equal(github.calls[1].options.headers.Authorization, "Bearer test-access-token");
  assert.equal(github.calls[1].options.redirect, "error");
  const html = await result.text();
  assert.doesNotMatch(html, /test-client-secret|valid-code|code_verifier/);
  const popup = runPopup(html);
  assert.deepEqual(popup.sent, [{ data: "authorizing:github", targetOrigin: env.CMS_ORIGIN }]);
  for (const event of [
    { data: "authorizing:github", origin: "https://evil.example", source: popup.opener },
    { data: "authorizing:github", origin: env.CMS_ORIGIN, source: {} },
    { data: "wrong-handshake", origin: env.CMS_ORIGIN, source: popup.opener },
  ]) popup.dispatch(event);
  assert.equal(popup.sent.length, 1);
  popup.dispatch({ data: "authorizing:github", origin: env.CMS_ORIGIN, source: popup.opener });
  assert.deepEqual(popup.sent[1], {
    data: 'authorization:github:success:{"token":"test-access-token","provider":"github"}',
    targetOrigin: env.CMS_ORIGIN,
  });
  assert.equal(popup.listeners.size, 0);
  assert.equal(result.headers.get("Content-Security-Policy"), `default-src 'none'; script-src 'nonce-${popup.nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  assert.doesNotMatch(html, /postMessage\([^;]*["']\*["']|unsafe-inline/);
});

test("callback rejects a different GitHub account without releasing its token", async () => {
  const { cookie, session } = await startLogin();
  for (const login of ["another-user", "Oliver492", undefined]) {
    const github = githubFetch({ token: "must-never-leak", userData: { login } });
    const result = await handleRequest(callback(session, cookie), env, github.fetch);
    assert.equal(result.status, 403);
    assertCleared(result);
    const html = await result.text();
    assert.doesNotMatch(html, /must-never-leak|test-client-secret|authorization:github:success/);
    assert.match(html, /authorization:github:error:/);
  }
});

test("upstream failures never echo access tokens, credentials or upstream errors", async () => {
  const { cookie, session } = await startLogin();
  const failures = [
    githubFetch({ tokenStatus: 401, tokenData: { error: "sensitive-upstream-detail", access_token: "must-never-leak" } }).fetch,
    githubFetch({ tokenData: { error: "sensitive-upstream-detail", access_token: "must-never-leak" } }).fetch,
    githubFetch({ tokenData: {} }).fetch,
    githubFetch({ token: "must-never-leak", userStatus: 401 }).fetch,
    async () => { throw new Error("must-never-leak sensitive-upstream-detail test-client-secret"); },
    async () => new Response("must-never-leak invalid-json"),
  ];
  for (const fetchImpl of failures) {
    const result = await handleRequest(callback(session, cookie), env, fetchImpl);
    assert.equal(result.status, 502);
    assertCleared(result);
    assert.doesNotMatch(await result.text(), /must-never-leak|sensitive-upstream-detail|test-client-secret|authorization:github:success/);
  }
});

test("token payload cannot break out of the nonce-protected popup script", async () => {
  const { cookie, session } = await startLogin();
  const token = '</script><script>alert("token")</script>&\u2028';
  const github = githubFetch({ token });
  const result = await handleRequest(callback(session, cookie), env, github.fetch);
  assert.equal(result.status, 200);
  const html = await result.text();
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  assert.equal((html.match(/<\/script>/g) ?? []).length, 1);
  assert.doesNotMatch(html, /alert\("token"\)/);
  const popup = runPopup(html);
  popup.dispatch({ data: "authorizing:github", origin: env.CMS_ORIGIN, source: popup.opener });
  const content = JSON.parse(popup.sent[1].data.slice("authorization:github:success:".length));
  assert.equal(content.token, token);
});

test("unknown paths and write methods do not redirect", async () => {
  const missing = await handleRequest(request("/elsewhere"), env);
  assert.equal(missing.status, 404);
  const post = await handleRequest(new Request(`${oauthOrigin}/callback`, { method: "POST" }), env);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET");
  assert.equal(post.headers.get("Location"), null);
  assertCleared(post);
});
