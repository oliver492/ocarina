export const articleSections = {
	posts: { title: "归档", archivePath: "/archive/" },
	notes: { title: "随记", archivePath: "/notes/" },
	projects: { title: "项目", archivePath: "/projects/" },
} as const;

export type ArticleCollection = keyof typeof articleSections;
