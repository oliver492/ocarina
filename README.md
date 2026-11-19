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

## 修改个人资料

编辑 `src/config.ts`，修改博客标题、副标题、语言、主题色、横幅、头像、昵称和简介。关于页面位于 `src/content/spec/about.md`。

需要在本地显示个人 GitHub 链接时，将 `.env.example` 复制为 `.env`，填写 `PUBLIC_GITHUB_USERNAME`。这个用户名会显示在公开网页中，不要填入令牌或密码。GitHub Actions 发布时会自动使用仓库所有者的用户名。

```dotenv
PUBLIC_GITHUB_USERNAME=your-github-username
```

## 写文章

```sh
pnpm new-post my-first-note
```

文章保存在 `src/content/posts/`。可以使用单个 `.md` 文件，也可以用 `文章名/index.md` 与图片放在同一目录中。

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

将 `draft` 设为 `true` 可将文章排除在构建、归档和 RSS 之外。已发布文章尽量不修改文件名，以保持外部链接稳定。

当前三篇文章是可替换的中文示例：欢迎页、Markdown 排版和写作发布流程。

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
src/content/posts/       Markdown 文章
src/content/spec/about.md 关于页面
src/assets/              站点图片等资源
public/                  原样复制的静态文件
```

## 模板与许可

基于 [Fuwari](https://github.com/saicaca/fuwari)，遵循仓库中的 [MIT License](LICENSE)。保留原始许可文件及页脚主题来源。

横幅沿用 [Fuwari 模板附带的演示图片](https://github.com/saicaca/fuwari/blob/main/src/assets/images/demo-banner.png)。上游演示站的图片致谢包括 [Unsplash](https://unsplash.com/)、[Stella 的「星と少女」](https://www.pixiv.net/artworks/108916539) 和 [Rabbit 的展示作品](https://civitai.com/posts/586908)，上游未逐一说明图片对应关系。替换图片后请保留新图片需要的来源署名，并遵循其使用许可。

部署流程参考 [Astro 的 GitHub Pages 官方文档](https://docs.astro.build/en/guides/deploy/github/)。
