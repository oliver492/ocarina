# ocarina

oliver 的个人博客，使用 **Astro + Fuwari**，通过 **GitHub Actions** 构建并发布到 **GitHub Pages**。

首版包含中文导航、横幅、个人资料、文章列表、归档、分类、标签、目录、明暗主题、全文搜索和 RSS。评论与 Moments 暂未加入。

## 本地运行

建议使用 Node.js 24 和项目 `package.json` 中指定版本的 pnpm，保留 `pnpm-lock.yaml`。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的本地地址。开发模式下不会生成正式搜索索引；检查全文搜索时，请使用构建后的预览。

```sh
pnpm check
pnpm build
pnpm preview
```

| 命令 | 用途 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 按锁文件安装依赖 |
| `pnpm dev` | 开发预览，默认端口 4321 |
| `pnpm check` | 检查 Astro 和 TypeScript |
| `pnpm build` | 构建静态页面并生成 Pagefind 搜索索引 |
| `pnpm preview` | 预览 `dist/` 中的正式构建 |
| `pnpm new-post <filename>` | 新建 Markdown 文章 |
| `pnpm cms:local` | 启动仅本机可用的网页写作服务 |
| `pnpm test:cms` | 检查后台启动、图片路径和登录代理 |

## 修改个人资料

编辑 `src/config.ts`，修改博客标题、副标题、语言、主题色、横幅、头像、昵称和简介。关于页面位于 `src/content/spec/about.md`。

需要在本地显示个人 GitHub 链接时，将 `.env.example` 复制为 `.env`，填写 `PUBLIC_GITHUB_USERNAME`。这个用户名会显示在公开网页中，不要填入令牌或密码。GitHub Actions 发布时会自动使用仓库所有者的用户名。

```dotenv
PUBLIC_GITHUB_USERNAME=your-github-username
```

## 写文章

### 在网页后台写作

博客页脚的「写作后台」进入 `/admin/`。后台使用 Decap CMS，左侧分别管理「归档文章」「随记」「项目」，可新建和编辑文章、添加标签、选择封面、上传图片，并在右侧预览正文。默认开启「草稿」，准备发布时关闭它，再点击「发布」。这个按钮表示保存内容；博客页面会在开发预览或下一次构建后更新。

本地使用时需要两个终端，均在项目根目录运行：

```sh
# 终端一
pnpm dev

# 终端二
pnpm cms:local
```

打开 `http://localhost:4321/admin/`，点击「登录」即可进入本机编辑器；本地模式不要求 GitHub 登录。请使用 `localhost` 而非 `127.0.0.1` 访问页面，代理只允许 `http://localhost:4321` 这一来源。若在 `.env` 配置了 `SITE_URL` 子路径，请跟随开发服务显示的地址加 `admin/`。

点击「发布」后，内容保存到本地文章目录，图片保存到 `public/images/uploads/`，不会自动提交或推送 Git。确认文章后再使用现有 Git 命令提交并推送。子目录字段可选；已发布文章请保留原文件名与目录，避免改变网址。

线上地址为 `https://oliver492.github.io/ocarina/admin/`，通过 GitHub 登录后直接保存至 `main`，触发 GitHub Pages 重新构建。线上登录使用独立 Cloudflare Worker，具体命令见 [登录代理部署说明](workers/cms-auth/README.md)。Worker 地址在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 中设置为 `CMS_AUTH_URL`，工作流会通过 `PUBLIC_CMS_AUTH_URL` 传给后台。没有配置时会显示设置提示。

草稿仅从正式博客页面隐藏；此仓库公开，提交或线上保存的草稿原文仍可被查看。图片在 Markdown 中使用 `/images/uploads/文件名`，构建会自动添加 `/ocarina/` 子路径。正文预览采用基础排版，最终主题效果以博客页面为准。旧文章中指向 `src/assets/` 的相对路径图片可能无法在后台预览，博客页面仍会正常显示；网页上传的图片使用媒体库预览。

### 在文件中写作

三个栏目各自管理文章，内容放在对应目录中：

| 栏目 | 写作目录 | 列表页面 | 文章地址示例 |
| --- | --- | --- | --- |
| 首页与归档 | `src/content/posts/` | `/`、`/archive/` | `/posts/my-first-note/` |
| 随记 | `src/content/notes/` | `/notes/` | `/notes/first-note/` |
| 项目 | `src/content/projects/` | `/projects/` | `/projects/ocarina/` |

首页和原有归档列出 `posts` 中的文章，随记与项目页面分别列出各自目录中的文章，不会互相混入。栏目由文件所在的目录决定；`category` 和 `tags` 用于整理栏目内部的文章。

可以直接手动新建 `.md` 文件，也可以用 `文章名/index.md` 与图片放在同一目录中。各栏目都支持子目录，例如 `src/content/notes/books/reading.md` 对应 `/notes/books/reading/`。

以下命令仍然只会在 `src/content/posts/` 中新建文章模板。随记、项目可以在各自目录下手动新建文件，填写同样的文章头部信息：

```sh
pnpm new-post my-first-note
```

```yaml
---
title: 我的第一篇笔记
published: 2026-11-19
description: 用一句话概括文章内容。
image: ''
tags: [笔记]
category: 随记
draft: false
lang: zh_CN
---
```

三个栏目共用上述文章格式。将 `draft` 设为 `true` 时，本地开发预览仍可见，但正式构建不会生成这篇文章，也不会将其加入栏目列表、搜索索引和 RSS。

正式构建后的全文搜索和全站 RSS 会收录所有栏目的已发布文章。开发模式的搜索仍沿用模板的占位结果，需要检查真实搜索时请使用 `pnpm build` 和 `pnpm preview`。

随记和项目中各有一篇可替换的示例文章。已发布文章尽量不改文件名或移动目录，以保持外部链接稳定。

## 首次发布到 GitHub Pages

1. 在自己的 GitHub 账号下创建公开仓库，将这个项目推送到 `main` 分支。
2. 打开仓库的 **Settings → Pages → Build and deployment**，将 **Source** 设为 **GitHub Actions**。
3. 在 **Actions** 中运行部署工作流，或向 `main` 再推送一次提交。
4. 工作流会检查代码、构建站点、生成搜索索引，并部署到 GitHub Pages。完成后从部署结果或 Pages 设置中打开网站。

两种仓库名称都支持：

| 仓库 | 默认网址 |
| --- | --- |
| `<用户名>.github.io` | `https://<用户名>.github.io/` |
| 普通仓库，例如 `ocarina` | `https://<用户名>.github.io/ocarina/` |

工作流从 GitHub Pages 读取正式网址，并通过 `SITE_URL` 传入构建。项目会自动从网址中计算站点来源与子路径，不需要把用户名或仓库名写死在代码里。

本地默认使用 `http://localhost:4321/`。如果需要在本地检查正式域名、RSS、站点地图，或测试项目子路径，在 `.env` 中设置完整网址后重新构建：

```dotenv
SITE_URL=https://your-github-username.github.io/ocarina/
PUBLIC_GITHUB_USERNAME=your-github-username
```

`SITE_URL` 必须包含完整的 `https://`（本地可用 `http://`）及实际子路径。子路径站点需要在终端显示的对应路径下预览。

绑定自定义域名时，先按 [GitHub 官方说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) 配置域名，再重新运行部署，让工作流读取新的正式网址。

## 使用命令行首次发布

不需要 Codex 的 GitHub 插件。使用 [GitHub CLI](https://cli.github.com/) 管理仓库和 Pages，Git 负责提交、推送代码。若命令行尚未登录，先运行：

```sh
gh auth login --hostname github.com --git-protocol https --web --scopes workflow
```

对于尚未推送的新项目，以下命令在 PowerShell 中执行。请先确认提交署名与邮箱符合你的公开信息偏好。

```powershell
$owner = gh api user --jq .login
$repo = "$owner/ocarina"
git add .
git commit -m "Initialize ocarina [skip ci]"
gh repo create $repo --public --source . --remote origin --push
gh api --method POST "repos/$repo/pages" -f build_type=workflow
gh workflow run build.yml --repo $repo --ref main
```

首次提交跳过自动运行，是为了先建立 `main` 分支、启用 Pages，再手动启动部署，避免 Pages 尚未启用导致首次构建失败。之后正常提交并 `git push` 就会自动发布。

可以用 `gh run list --repo $repo` 查看运行记录，再用 `gh run watch <运行ID> --repo $repo --exit-status` 等待部署完成。

## 目录

```text
.github/workflows/        检查、构建与发布
src/config.ts            站点、导航和个人资料配置
src/content/posts/       首页与归档的 Markdown 文章
src/content/notes/       随记栏目的 Markdown 文章
src/content/projects/    项目栏目的 Markdown 文章
src/content/spec/about.md 关于页面
src/assets/              站点图片等资源
public/                  原样复制的静态文件
public/admin/            写作后台配置与固定版本的编辑器资源
workers/cms-auth/        Cloudflare GitHub 登录代理
```

## 模板与许可

基于 [Fuwari](https://github.com/saicaca/fuwari)，遵循仓库中的 [MIT License](LICENSE)。保留原始许可文件及页脚主题来源。

横幅沿用 [Fuwari 模板附带的演示图片](https://github.com/saicaca/fuwari/blob/main/src/assets/images/demo-banner.png)。上游演示站的图片致谢包括 [Unsplash](https://unsplash.com/)、[Stella 的「星と少女」](https://www.pixiv.net/artworks/108916539) 和 [Rabbit 的展示作品](https://civitai.com/posts/586908)，上游未逐一说明图片对应关系。替换图片后请保留新图片需要的来源署名，并遵循其使用许可。

部署流程参考 [Astro 的 GitHub Pages 官方文档](https://docs.astro.build/en/guides/deploy/github/)。
