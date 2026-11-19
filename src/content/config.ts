import { defineCollection, z } from "astro:content";

const articleDate = z
	.union([z.date(), z.string().trim().min(1)])
	.pipe(z.coerce.date());
const optionalText = z.preprocess(
	(value) => value ?? undefined,
	z.string().default(""),
);

const articleSchema = z.object({
	title: z.string(),
	published: articleDate,
	updated: z.preprocess(
		(value) =>
			value === null || (typeof value === "string" && !value.trim())
				? undefined
				: value,
		articleDate.optional(),
	),
	draft: z.boolean().optional().default(false),
	description: optionalText,
	image: optionalText,
	tags: z.preprocess(
		(value) => (value === null || value === "" ? undefined : value),
		z.array(z.string()).default([]),
	),
	category: optionalText,
	lang: optionalText,

	/* For internal use */
	prevTitle: z.string().default(""),
	prevSlug: z.string().default(""),
	nextTitle: z.string().default(""),
	nextSlug: z.string().default(""),
});
const specCollection = defineCollection({
	schema: z.object({}),
});
export const collections = {
	posts: defineCollection({ schema: articleSchema }),
	notes: defineCollection({ schema: articleSchema }),
	projects: defineCollection({ schema: articleSchema }),
	spec: specCollection,
};
