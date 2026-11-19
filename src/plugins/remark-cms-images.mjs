import { visit } from "unist-util-visit";

export function remarkCmsImages({ basePath = "/" } = {}) {
	const base = basePath.replace(/\/+$/, "");
	return (tree) => {
		if (!base) return;
		const imageReferences = new Set();
		visit(tree, "imageReference", (node) => {
			imageReferences.add(node.identifier);
		});
		visit(tree, ["image", "definition"], (node) => {
			if (node.type === "definition" && !imageReferences.has(node.identifier)) {
				return;
			}
			if (
				node.url.startsWith("/images/") &&
				!node.url.startsWith(`${base}/images/`)
			) {
				node.url = `${base}${node.url}`;
			}
		});
	};
}
