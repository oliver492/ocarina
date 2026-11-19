import { type CollectionEntry, getCollection } from "astro:content";
import type { ArticleCollection } from "@constants/sections";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils.ts";

export type ArticleEntry = CollectionEntry<ArticleCollection>;

async function getRawSortedPosts<C extends ArticleCollection = "posts">(
	collection: C = "posts" as C,
) {
	const allBlogPosts = await getCollection(collection, ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort(
		(a, b) => b.data.published.getTime() - a.data.published.getTime(),
	);
	return sorted;
}

export async function getSortedPosts<C extends ArticleCollection = "posts">(
	collection: C = "posts" as C,
) {
	const sorted = await getRawSortedPosts(collection);
	return sorted.map((post, index) => ({
		...post,
		data: {
			...post.data,
			nextSlug: sorted[index - 1]?.slug ?? "",
			nextTitle: sorted[index - 1]?.data.title ?? "",
			prevSlug: sorted[index + 1]?.slug ?? "",
			prevTitle: sorted[index + 1]?.data.title ?? "",
		},
	}));
}
export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(
	collection: ArticleCollection = "posts",
): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts(collection);

	const sortedPostsList = sortedFullPosts.map((post) => ({
		slug: post.slug,
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(
	collection: ArticleCollection = "posts",
): Promise<Tag[]> {
	const allBlogPosts = await getRawSortedPosts(collection);

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(
	collection: ArticleCollection = "posts",
): Promise<Category[]> {
	const allBlogPosts = await getRawSortedPosts(collection);
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c, collection),
		});
	}
	return ret;
}
