import { articleSections, type ArticleCollection } from "@constants/sections";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

export function pathsEqual(path1: string, path2: string) {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function getPostUrlBySlug(
	slug: string,
	collection: ArticleCollection = "posts",
): string {
	return url(`/${collection}/${slug}/`);
}

export function getTagUrl(
	tag: string,
	collection: ArticleCollection = "posts",
): string {
	const archivePath = articleSections[collection].archivePath;
	if (!tag) return url(archivePath);
	return url(`${archivePath}?tag=${encodeURIComponent(tag.trim())}`);
}

export function getCategoryUrl(
	category: string | null,
	collection: ArticleCollection = "posts",
): string {
	const archivePath = articleSections[collection].archivePath;
	if (
		!category ||
		category.trim() === "" ||
		category.trim().toLowerCase() === i18n(I18nKey.uncategorized).toLowerCase()
	)
		return url(`${archivePath}?uncategorized=true`);
	return url(`${archivePath}?category=${encodeURIComponent(category.trim())}`);
}

export function getArticleCollection(pathname: string): ArticleCollection {
	const normalizedPath = `${pathname.replace(/\/+$/, "")}/`;
	for (const collection of Object.keys(articleSections) as ArticleCollection[]) {
		if (normalizedPath.startsWith(url(`/${collection}/`))) return collection;
	}
	return "posts";
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}

export function url(path: string) {
	return joinUrl("", import.meta.env.BASE_URL, path);
}
