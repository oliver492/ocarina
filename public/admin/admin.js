(async () => {
  const { local, basePath, authUrl } = window.OCARINA_CMS;
  const panel = document.getElementById("cms-status");
  const message = document.getElementById("cms-message");
  const help = document.getElementById("cms-help");
  const retry = document.getElementById("cms-retry");
  const proxyUrl = "http://127.0.0.1:8081/api/v1";

  function showError(text, detail, canRetry = false) {
    message.textContent = text;
    help.textContent = detail;
    help.hidden = false;
    retry.hidden = !canRetry;
  }

  async function start() {
    retry.hidden = true;
    help.hidden = true;
    if (!window.CMS) {
      showError("编辑器未能加载。", "请刷新页面；如果持续失败，检查 admin/vendor 中的静态文件。", true);
      return;
    }
    const config = {
      site_url: new URL(basePath, location.origin).href,
      display_url: new URL(basePath, location.origin).href,
      local_backend: false,
    };
    if (local) {
      if (location.origin !== "http://localhost:4321") {
        showError("请使用本地写作地址。", `请通过 http://localhost:4321${basePath.replace(/\/$/, "")}/admin/ 访问，写作服务只允许这一来源。`);
        return;
      }
      try {
        const response = await fetch(proxyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "info" }),
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok || (await response.json()).type !== "local_fs") throw new Error("Proxy unavailable");
        config.local_backend = { url: proxyUrl };
      } catch {
        showError("请先启动本地写作服务。", "在项目目录另开终端运行 pnpm cms:local，保持 pnpm dev 运行，并通过 http://localhost:4321/admin/ 访问。", true);
        return;
      }
    } else {
      try {
        const auth = new URL(authUrl);
        if (auth.protocol !== "https:" || auth.origin !== authUrl) throw new Error("Invalid URL");
        config.backend = { base_url: auth.origin, auth_endpoint: "auth" };
      } catch {
        showError("线上写作登录尚未配置。", "请按项目 workers/cms-auth/README.md 部署 Cloudflare Worker，在 GitHub 仓库变量中设置 CMS_AUTH_URL，然后重新发布博客。本地可使用 pnpm dev 与 pnpm cms:local 写作。");
        return;
      }
    }
    try {
      window.CMS.init({ config });
      window.CMS.registerPreviewStyle(new URL(`${basePath.replace(/\/$/, "")}/admin/preview.css`, location.origin).href);
      panel.remove();
    } catch {
      showError("编辑器启动失败。", "请检查后台配置文件后重新加载页面。", true);
    }
  }
  retry.addEventListener("click", start);
  await start();
})();
