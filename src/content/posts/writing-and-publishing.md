---
title: 示例：从写作到发布
published: 2026-11-19
description: 记录这个博客的日常写作流程：新建文章、本地预览，再通过 GitHub 自动发布。
tags: [Astro, GitHub Pages, 写作]
category: 博客
draft: false
lang: zh_CN
---

这是一篇**使用说明示例**，介绍 ocarina 当前采用的写作和发布方式。

## 新建一篇文章

在项目目录中运行：

```sh
pnpm new-post my-first-note
```

命令会在 `src/content/posts/` 下生成 Markdown 文件。打开它，填写标题、日期、摘要、分类和标签，再写入正文。

```yaml
---
title: 我的第一篇笔记
published: 2026-11-19
description: 用一句话说明这篇文章的主要内容。
tags: [笔记]
category: 随记
draft: false
lang: zh_CN
---
```

尚未写完的文章可以设置 `draft: true`，这样就不会出现在正式构建的博客中。

## 在本地阅读一遍

写作时使用开发预览：

```sh
pnpm dev
```

需要检查正式页面和全文搜索时，先构建，再预览构建结果：

```sh
pnpm check
pnpm build
pnpm preview
```

全文搜索的索引在构建时生成，所以应在构建后的预览中检查搜索结果。

## 推送后自动发布

GitHub 仓库完成首次 Pages 配置后，将修改推送到 `main` 分支，Actions 就会检查并构建站点，再发布到 GitHub Pages。

如果页面还没有更新，可以打开仓库的 Actions 页面查看这次任务是否完成。具体的首次部署步骤保存在项目 README 中。

## 保持链接稳定

文章文件名会参与生成网址。正式发布后，尽量保留已有文件名，避免分享出去的旧链接失效。

图片可以与文章放在同一个文件夹中，并使用相对路径引用，便于之后一起整理和备份。
