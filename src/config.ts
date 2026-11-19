import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

const githubUsername = import.meta.env?.PUBLIC_GITHUB_USERNAME?.trim();
const githubUrl = githubUsername ? `https://github.com/${githubUsername}` : "";

export const siteConfig: SiteConfig = {
	title: "ocarina",
	subtitle: "记录技术、学习与生活",
	lang: "zh_CN", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: true,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: true,
			text: "Fuwari",
			url: "https://github.com/saicaca/fuwari/blob/main/src/assets/images/demo-banner.png",
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [{ src: "/favicon.svg", sizes: "any" }],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		...(githubUrl ? [{
			name: "GitHub",
			url: githubUrl,
			external: true,
		}] : []),
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "/images/avatar.svg",
	name: "oliver",
	bio: "记录所学，分享所想。",
	links: githubUrl ? [{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: githubUrl,
		}] : [],
};

export const licenseConfig: LicenseConfig = {
	enable: false,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
