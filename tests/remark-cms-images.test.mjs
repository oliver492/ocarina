import assert from "node:assert/strict";
import test from "node:test";
import { remarkCmsImages } from "../src/plugins/remark-cms-images.mjs";

function rewriteImages(basePath, urls) {
	const children = urls.map((url) => ({ type: "image", url, alt: "" }));
	remarkCmsImages({ basePath })({ type: "root", children });
	return children.map((node) => node.url);
}

test("root deployments keep portable CMS image paths", () => {
	assert.deepEqual(rewriteImages("/", ["/images/uploads/photo.png"]), [
		"/images/uploads/photo.png",
	]);
});

test("repository deployments prefix uploads and preserve query strings", () => {
	for (const base of ["/ocarina/", "/ocarina"]) {
		assert.deepEqual(
			rewriteImages(base, ["/images/uploads/photo.png?size=2#preview"]),
			["/ocarina/images/uploads/photo.png?size=2#preview"],
		);
	}
});

test("already prefixed paths stay unchanged, including an images base", () => {
	assert.deepEqual(rewriteImages("/ocarina/", ["/ocarina/images/photo.png"]), [
		"/ocarina/images/photo.png",
	]);
	assert.deepEqual(rewriteImages("/images/", ["/images/images/photo.png"]), [
		"/images/images/photo.png",
	]);
});

test("external, relative and other root assets stay unchanged", () => {
	const urls = [
		"https://example.com/images/photo.png",
		"//example.com/images/photo.png",
		"data:image/png;base64,AA==",
		"./images/photo.png",
		"/assets/photo.png",
	];
	assert.deepEqual(rewriteImages("/ocarina/", urls), urls);
});

test("image references rewrite their definitions without changing link definitions", () => {
	const imageDefinition = {
		type: "definition",
		identifier: "cover",
		url: "/images/uploads/cover.png",
	};
	const linkDefinition = {
		type: "definition",
		identifier: "download",
		url: "/images/uploads/original.png",
	};
	const tree = {
		type: "root",
		children: [
			imageDefinition,
			linkDefinition,
			{
				type: "paragraph",
				children: [
					{
						type: "imageReference",
						identifier: "cover",
						referenceType: "full",
					},
					{
						type: "linkReference",
						identifier: "download",
						referenceType: "full",
					},
				],
			},
		],
	};
	remarkCmsImages({ basePath: "/ocarina/" })(tree);
	assert.equal(imageDefinition.url, "/ocarina/images/uploads/cover.png");
	assert.equal(linkDefinition.url, "/images/uploads/original.png");
});
