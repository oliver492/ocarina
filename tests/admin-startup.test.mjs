import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const startupCode = await readFile(new URL("../public/admin/admin.js", import.meta.url), "utf8");
const proxyUrl = "http://127.0.0.1:8081/api/v1";
const authUrl = "https://ocarina-cms-auth.test-account.workers.dev";

async function startAdmin({ local = false, basePath = "/", auth = authUrl, origin = "https://oliver492.github.io", fetchImpl } = {}) {
  const elements = new Map(["cms-status", "cms-message", "cms-help", "cms-retry"].map((id) => [id, {
    textContent: "",
    hidden: true,
    removed: false,
    addEventListener() {},
    remove() { this.removed = true; },
  }]));
  const fetchCalls = [];
  const initCalls = [];
  const previewStyles = [];
  const globals = {
    URL,
    AbortSignal,
    location: new URL(origin),
    document: { getElementById: (id) => elements.get(id) },
    window: {
      OCARINA_CMS: { local, basePath, authUrl: auth },
      CMS: {
        init: (options) => initCalls.push(JSON.parse(JSON.stringify(options))),
        registerPreviewStyle: (url) => previewStyles.push(url),
      },
    },
    fetch: async (...args) => {
      fetchCalls.push(args);
      if (!fetchImpl) throw new Error("Unexpected proxy request");
      return fetchImpl(...args);
    },
  };
  await runInNewContext(startupCode, globals);
  return { elements, fetchCalls, initCalls, previewStyles };
}

test("local startup uses the verified file proxy and correct root/subpath preview URL", async () => {
  for (const basePath of ["/", "/ocarina/"]) {
    const result = await startAdmin({
      local: true,
      basePath,
      origin: "http://localhost:4321",
      fetchImpl: async () => Response.json({ type: "local_fs" }),
    });
    assert.equal(result.fetchCalls.length, 1);
    const [url, options] = result.fetchCalls[0];
    assert.equal(url, proxyUrl);
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), { action: "info" });
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(result.initCalls, [{ config: {
      site_url: `http://localhost:4321${basePath}`,
      display_url: `http://localhost:4321${basePath}`,
      local_backend: { url: proxyUrl },
    } }]);
    assert.deepEqual(result.previewStyles, [`http://localhost:4321${basePath}admin/preview.css`]);
    assert.equal(result.elements.get("cms-status").removed, true);
  }
});

test("an unavailable or invalid local proxy stops startup without a GitHub fallback", async () => {
  for (const fetchImpl of [
    async () => { throw new Error("Proxy offline"); },
    async () => Response.json({ type: "local_fs" }, { status: 503 }),
    async () => Response.json({ type: "github" }),
    async () => new Response("invalid-json"),
  ]) {
    const result = await startAdmin({ local: true, origin: "http://localhost:4321", fetchImpl });
    assert.equal(result.fetchCalls.length, 1);
    assert.equal(result.initCalls.length, 0);
    assert.equal(result.previewStyles.length, 0);
    assert.equal(result.elements.get("cms-status").removed, false);
    assert.equal(result.elements.get("cms-retry").hidden, false);
    assert.match(result.elements.get("cms-message").textContent, /本地写作服务/);
  }
});

test("development on another origin stops before contacting the proxy or CMS", async () => {
  for (const origin of ["http://127.0.0.1:4321", "http://[::1]:4321", "http://localhost:4322", "https://localhost:4321", "https://other.example"]) {
    const result = await startAdmin({ local: true, basePath: "/ocarina/", origin });
    assert.equal(result.fetchCalls.length, 0);
    assert.equal(result.initCalls.length, 0);
    assert.equal(result.elements.get("cms-status").removed, false);
    assert.match(result.elements.get("cms-help").textContent, /http:\/\/localhost:4321\/ocarina\/admin\//);
  }
});

test("production without an exact HTTPS auth origin stops without probing localhost", async () => {
  for (const auth of ["", "not-a-url", "http://auth.example", `${authUrl}/`, `${authUrl}/auth`, `${authUrl}?secret=value`, `${authUrl}#fragment`, "https://user:password@auth.example"]) {
    const result = await startAdmin({ auth });
    assert.equal(result.fetchCalls.length, 0);
    assert.equal(result.initCalls.length, 0);
    assert.equal(result.previewStyles.length, 0);
    assert.equal(result.elements.get("cms-status").removed, false);
    assert.match(result.elements.get("cms-message").textContent, /线上写作登录尚未配置/);
  }
});

test("production uses the auth worker and correct root/subpath preview URL", async () => {
  for (const basePath of ["/", "/ocarina/"]) {
    const result = await startAdmin({ basePath });
    assert.equal(result.fetchCalls.length, 0);
    assert.deepEqual(result.initCalls, [{ config: {
      site_url: `https://oliver492.github.io${basePath}`,
      display_url: `https://oliver492.github.io${basePath}`,
      local_backend: false,
      backend: { base_url: authUrl, auth_endpoint: "auth" },
    } }]);
    assert.deepEqual(result.previewStyles, [`https://oliver492.github.io${basePath}admin/preview.css`]);
    assert.equal(result.elements.get("cms-status").removed, true);
  }
});
