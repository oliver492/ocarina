const COOKIE_NAME = "__Host-ocarina-cms-oauth";
const SESSION_SECONDS = 600;
const encoder = new TextEncoder();
const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};
const clearCookie = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...securityHeaders, ...headers } });
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
}

const randomString = (length = 32) => base64url(crypto.getRandomValues(new Uint8Array(length)));

function getConfig(env) {
  const origin = (value) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || value !== url.origin || url.username || url.password || url.hostname.includes("replace-with-your-subdomain")) {
      throw new Error("Invalid origin");
    }
    return url.origin;
  };
  if (typeof env.GITHUB_CLIENT_ID !== "string" ||
      !/^[A-Za-z0-9._-]{1,200}$/.test(env.GITHUB_CLIENT_ID) ||
      /^(undefined|null)$/i.test(env.GITHUB_CLIENT_ID)) {
    throw new Error("Invalid GITHUB_CLIENT_ID");
  }
  if (typeof env.GITHUB_CLIENT_SECRET !== "string" ||
      !env.GITHUB_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET.length > 2048 ||
      /^(undefined|null)$/i.test(env.GITHUB_CLIENT_SECRET) ||
      /\s/.test(env.GITHUB_CLIENT_SECRET)) {
    throw new Error("Invalid GITHUB_CLIENT_SECRET");
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(env.ALLOWED_GITHUB_USER ?? "")) {
    throw new Error("Missing configuration");
  }
  return {
    cmsOrigin: origin(env.CMS_ORIGIN),
    oauthOrigin: origin(env.OAUTH_ORIGIN),
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    allowedUser: env.ALLOWED_GITHUB_USER,
  };
}

function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sessionCookie(session, secret) {
  const data = base64url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(data));
  return `${COOKIE_NAME}=${data}.${base64url(new Uint8Array(signature))}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}

async function readSession(request, config) {
  const cookies = (request.headers.get("Cookie") ?? "").split(";").map((c) => c.trim());
  const matches = cookies.filter((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  if (matches.length !== 1) throw new Error("Invalid session");
  const value = matches[0].slice(COOKIE_NAME.length + 1);
  if (value.length > 2048) throw new Error("Invalid session");
  const parts = value.split(".");
  if (parts.length !== 2 || !await crypto.subtle.verify("HMAC", await signingKey(config.clientSecret), decodeBase64url(parts[1]), encoder.encode(parts[0]))) {
    throw new Error("Invalid session");
  }
  const session = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
  const age = Date.now() - session.issuedAt;
  if (!/^[A-Za-z0-9_-]{43}$/.test(session.state) ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.verifier) ||
      !Number.isSafeInteger(session.issuedAt) || age < 0 || age >= SESSION_SECONDS * 1000 ||
      session.origin !== config.oauthOrigin) {
    throw new Error("Invalid session");
  }
  return session;
}

const scriptJSON = (value) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

function popupResponse(config, status, content, httpStatus = 200) {
  const nonce = randomString(18);
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>ocarina 登录</title>
<body><p>正在完成 GitHub 登录，请返回博客后台。</p><script nonce="${nonce}">
(() => {
  const allowedOrigin = ${scriptJSON(config.cmsOrigin)};
  const handshake = "authorizing:github";
  const result = ${scriptJSON(message)};
  if (!window.opener) return;
  const receiveMessage = (event) => {
    if (event.origin !== allowedOrigin || event.source !== window.opener || event.data !== handshake) return;
    window.removeEventListener("message", receiveMessage);
    window.opener.postMessage(result, allowedOrigin);
  };
  window.addEventListener("message", receiveMessage);
  window.opener.postMessage(handshake, allowedOrigin);
})();
</script></body></html>`;
  return response(html, httpStatus, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    "Set-Cookie": clearCookie,
  });
}

const popupError = (config, message, status) => popupResponse(config, "error", { provider: "github", message }, status);

async function handleAuth(url, config) {
  if (url.searchParams.get("provider") !== "github" ||
      (url.searchParams.has("site_id") && url.searchParams.get("site_id") !== new URL(config.cmsOrigin).hostname)) {
    return response("无效的登录请求。", 400, { "Set-Cookie": clearCookie });
  }
  const state = randomString();
  const verifier = randomString();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${config.oauthOrigin}/callback`,
    scope: "public_repo",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    login: config.allowedUser,
    allow_signup: "false",
  }).toString();
  const cookie = await sessionCookie({ state, verifier, issuedAt: Date.now(), origin: config.oauthOrigin }, config.clientSecret);
  return response(null, 302, { Location: authorize.href, "Set-Cookie": cookie });
}

async function handleCallback(request, url, config, fetchImpl) {
  let session;
  try {
    session = await readSession(request, config);
    if (url.searchParams.getAll("state").length !== 1 || url.searchParams.get("state") !== session.state) {
      throw new Error("Invalid state");
    }
  } catch {
    return popupError(config, "登录请求已失效，请关闭弹窗后重新登录。", 400);
  }
  if (url.searchParams.has("error")) return popupError(config, "GitHub 授权未完成，请重新登录。", 400);
  const code = url.searchParams.get("code");
  if (!code || code.length > 1024 || url.searchParams.getAll("code").length !== 1) {
    return popupError(config, "缺少有效的 GitHub 授权码，请重新登录。", 400);
  }
  try {
    const tokenResponse = await fetchImpl("https://github.com/login/oauth/access_token", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${config.oauthOrigin}/callback`,
        code_verifier: session.verifier,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const result = await tokenResponse.json();
    const token = result.access_token;
    if (result.error || typeof token !== "string" || !token || token.length > 4096 || /[\x00-\x20\x7f]/.test(token)) {
      throw new Error("Invalid token");
    }
    const userResponse = await fetchImpl("https://api.github.com/user", {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "ocarina-cms-auth",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!userResponse.ok) throw new Error("Identity check failed");
    const user = await userResponse.json();
    if (user.login !== config.allowedUser) return popupError(config, "此 GitHub 账户没有博客管理权限。", 403);
    return popupResponse(config, "success", { token, provider: "github" });
  } catch {
    return popupError(config, "GitHub 登录验证失败，请稍后重试。", 502);
  }
}

export async function handleRequest(request, env = {}, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    let ready = false;
    try {
      ready = url.protocol === "https:" && url.origin === getConfig(env).oauthOrigin;
    } catch {
      // The initial deployment can expose readiness before credentials are set.
    }
    return response(JSON.stringify({ ready }), 200, { "Content-Type": "application/json; charset=utf-8" });
  }
  let config;
  try {
    config = getConfig(env);
  } catch (error) {
    let message = "登录代理尚未配置完成。";
    if (error?.message === "Invalid GITHUB_CLIENT_ID") {
      message += "请从 GitHub OAuth App 页面复制真实 Client ID，重新录入 GITHUB_CLIENT_ID。";
    }
    if (error?.message === "Invalid GITHUB_CLIENT_SECRET") {
      message += "请从 GitHub OAuth App 页面生成或复制 Client Secret，重新录入 GITHUB_CLIENT_SECRET。";
    }
    return response(message, 503, { "Set-Cookie": clearCookie });
  }
  if (url.origin !== config.oauthOrigin || url.protocol !== "https:") {
    return response("无效的登录代理地址。", 400, { "Set-Cookie": clearCookie });
  }
  if (request.method !== "GET") return response("Method not allowed", 405, { Allow: "GET", "Set-Cookie": clearCookie });
  if (url.pathname === "/auth") return handleAuth(url, config);
  if (url.pathname === "/callback") return handleCallback(request, url, config, fetchImpl);
  return response("Not found", 404);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
