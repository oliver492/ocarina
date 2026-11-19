# ocarina 写作后台的 GitHub 登录代理

独立 Cloudflare Worker，只处理 Decap CMS 的 GitHub 登录，不迁移 GitHub Pages 博客。生产环境仅接受 HTTPS；没有数据库和运行时依赖。`/health` 返回 `{ "ready": true }` 表示地址和配置齐全，不代表 GitHub 凭据已经通过真实登录验证；未配置时返回 `{ "ready": false }`，不包含凭据或配置值。

本项目已部署地址：`https://ocarina-cms-auth.oliver492.workers.dev`。GitHub OAuth App 的回调地址填写 `https://ocarina-cms-auth.oliver492.workers.dev/callback`；博客后台地址是 `https://oliver492.github.io/ocarina/admin/`。

## 部署

在仓库根目录使用命令行操作。以下命令会临时运行 Wrangler，无须安装 GitHub 插件或全局工具。首次运行需要联网下载 Wrangler。

1. 登录 Cloudflare：

   ```powershell
   pnpm dlx wrangler@4 login
   ```

2. 先部署一次，取得终端输出的正式 Worker 地址：

   ```powershell
   pnpm dlx wrangler@4 deploy --config workers/cms-auth/wrangler.jsonc
   ```

   这次部署尚不能登录，访问输出地址的 `/health` 会返回 `{ "ready": false }`。将本目录 `wrangler.jsonc` 的 `OAUTH_ORIGIN` 替换为这个地址，形如 `https://ocarina-cms-auth.<账户子域>.workers.dev`，不加末尾 `/`。代码只接受精确地址；不要使用临时账号或预览地址作为生产 OAuth 地址。

3. 在 [GitHub OAuth Apps](https://github.com/settings/developers) 注册 OAuth App：

   - Application name：`ocarina CMS`
   - Homepage URL：`https://oliver492.github.io/ocarina/`
   - Authorization callback URL：上一步地址加 `/callback`
   - Enable Device Flow：保持不勾选
   - Expire user access tokens：取消勾选；[官方注册说明](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) 当前说明该项默认开启

   使用 OAuth App，当前最小实现不处理 expiring token / refresh token。注册后复制页面中的 Client ID，并在 Client secrets 中点击 Generate a new client secret 生成 Client Secret，供下一步在终端录入。

4. 将 GitHub 提供的 Client ID、Client Secret 分别录入 Worker secrets。终端会交互询问值，不要把值写进命令、源码、CMS 配置或聊天：

   ```powershell
   pnpm dlx wrangler@4 secret put GITHUB_CLIENT_ID --config workers/cms-auth/wrangler.jsonc
   pnpm dlx wrangler@4 secret put GITHUB_CLIENT_SECRET --config workers/cms-auth/wrangler.jsonc
   ```

5. 再次部署，让实际 `OAUTH_ORIGIN` 生效：

   ```powershell
   pnpm dlx wrangler@4 deploy --config workers/cms-auth/wrangler.jsonc
   ```

6. 访问 Worker 的 `/health`，应返回 `{ "ready": true }`。将这个不带末尾 `/` 的 Worker 地址保存为 GitHub 仓库 `oliver492/ocarina` 的 **Actions repository variable** `CMS_AUTH_URL`（Settings → Secrets and variables → Actions → Variables）。也可以通过已登录的 GitHub CLI 设置：

   ```powershell
   gh variable set CMS_AUTH_URL --repo oliver492/ocarina --body 'https://ocarina-cms-auth.<账户子域>.workers.dev'
   gh workflow run build.yml --repo oliver492/ocarina --ref main
   ```

   工作流会把 `CMS_AUTH_URL` 传为 Astro 的 `PUBLIC_CMS_AUTH_URL`，后台在构建时接入登录地址，无须修改 `public/admin/config.yml`。等待 Pages 发布完成后，从 `https://oliver492.github.io/ocarina/admin/` 使用 GitHub 登录，确认可以读取文章。修改仓库变量后必须重新构建发布才会生效。

   若在本机测试生产构建，可在当前 PowerShell 终端设置同一个公开地址后构建：

   ```powershell
   $env:PUBLIC_CMS_AUTH_URL = 'https://ocarina-cms-auth.<账户子域>.workers.dev'
   pnpm build
   ```

   `PUBLIC_CMS_AUTH_URL` 是公开的代理地址，不能填入 Client Secret 或 GitHub token。本地 `pnpm dev` 的写作模式使用 `pnpm cms:local`，不需要 OAuth 登录。

## 本地校验

如果登录跳转到 GitHub 404，检查跳转地址中的 `client_id` 是否为 `undefined` 或 `null`。这表示录入了占位文字，需要从 OAuth App 页面复制真实 Client ID，重新运行 `wrangler secret put GITHUB_CLIENT_ID`。更新后关闭旧的 404 窗口，从博客后台重新点击 GitHub 登录；刷新旧地址不会更新参数。Worker 会拒绝这些占位值并返回 `ready:false`。

Node.js 20 或更新版本，无须安装依赖，不连接 GitHub：

```powershell
node --test workers/cms-auth/test/oauth.test.mjs
```

## 登录边界

只允许 `oliver492` 登录，权限范围固定请求 `public_repo`，忽略请求中的任意 scope。OAuth App 的 `public_repo` 仍可访问该用户有权限的其他公开仓库，不能细化为只允许一个仓库；需要严格单仓库权限时，应另行采用 GitHub App 并验证令牌刷新适配。

state 和 PKCE verifier 放在使用 Client Secret 签名、十分钟有效的 host-only `HttpOnly` cookie 中，回调成功或失败都会清理。回调只向 `https://oliver492.github.io` 的原始打开窗口发送结果；同一 GitHub Pages 用户的不同仓库站点共享此 origin，浏览器不能按 `/ocarina/` 路径隔离权限。不要在这个账户的 Pages origin 上托管不可信脚本。更换 Client Secret 会使尚未完成的登录失效。

代理不记录或长期保存 GitHub token，但 Decap 浏览器端会持有登录 token；退出后台或撤销 GitHub OAuth App 授权可清除或撤销相应登录。

协议和安全参数依据：[Decap GitHub OAuth proxy](https://decapcms.org/docs/backends-overview/#using-github-with-an-oauth-proxy)、[GitHub OAuth / S256 PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)、[Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。
