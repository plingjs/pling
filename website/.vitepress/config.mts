import { defineConfig } from "vitepress";
import { EN_NAV, EN_SIDEBAR, ZH_NAV, ZH_SIDEBAR } from "./generated/content.mts";
import { demoDataPlugin } from "./plugins/demo-data.mts";
import { legacyRedirectsPlugin } from "./plugins/legacy-redirects.mts";
import { markdownIncludePlugin, tutorialPreviewPlugin } from "./plugins/markdown-include.mts";

const SITE_ORIGIN = "https://plingjs.dev";

const SOCIAL_LINKS = [
  {
    icon: {
      svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
    },
    link: "https://github.com/plingjs",
    ariaLabel: "Pling on GitHub",
  },
  {
    icon: {
      svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
    },
    link: "https://x.com/plingjs",
    ariaLabel: "Pling on X",
  },
];

// The chapter previews and recipe pages call the same-origin endpoints used by
// the examples site. During local documentation work, forward those paths to
// the gateway and recipe service started by `pnpm dev:examples`.
const LOCAL_API_PROXY = {
  "/api/agent": {
    target: "http://127.0.0.1:5192",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/agent/, ""),
  },
  "/api/recipe": {
    target: "http://127.0.0.1:5193",
    changeOrigin: false,
  },
};

const LOCAL_DEMO_PROXY = {
  "/demos": { target: "http://127.0.0.1:5191", changeOrigin: true },
  ...LOCAL_API_PROXY,
};

// VitePress loads unknown grammars lazily through Shiki's WASM engine. This
// documentation set only uses a small, fixed set; preloading them avoids the
// synchronous language-loading path during long dev sessions.
const DOC_LANGUAGES = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "vue",
  "bash",
  "sh",
  "json",
  "css",
  "html",
  "lua",
  "sql",
  "diff",
  "dotenv",
];

function routeFromRelativePath(relativePath: string): string {
  const path = relativePath.replaceAll("\\", "/").replace(/\.md$/, "");
  if (path === "index") return "/";
  if (path.endsWith("/index")) return `/${path.slice(0, -"index".length)}`;
  return `/${path}`;
}

function languageRoutes(route: string): { en: string; zh: string } {
  const isChinese = route === "/zh/" || route.startsWith("/zh/");
  if (isChinese) {
    return {
      en: route === "/zh/" ? "/" : route.slice("/zh".length),
      zh: route,
    };
  }
  return {
    en: route,
    zh: route === "/" ? "/zh/" : `/zh${route}`,
  };
}

function absoluteUrl(route: string): string {
  return `${SITE_ORIGIN}${route}`;
}

const enTheme = {
  nav: EN_NAV,
  sidebar: EN_SIDEBAR,
  socialLinks: SOCIAL_LINKS,
  outline: { level: [2, 3] as const, label: "On this page" },
  docFooter: { prev: "Previous", next: "Next" },
  lastUpdated: { text: "Last updated" },
  returnToTopLabel: "Return to top",
  sidebarMenuLabel: "Menu",
  darkModeSwitchLabel: "Appearance",
  lightModeSwitchTitle: "Switch to light theme",
  darkModeSwitchTitle: "Switch to dark theme",
  search: {
    provider: "local" as const,
    options: {
      translations: {
        button: { buttonText: "Search", buttonAriaLabel: "Search documentation" },
        modal: {
          noResultsText: "No results found",
          resetButtonTitle: "Clear query",
          footer: { selectText: "Select", navigateText: "Navigate", closeText: "Close" },
        },
      },
    },
  },
  notFound: {
    title: "Page not found",
    quote: "The page could not be found. Check the address, or return to the documentation home.",
    linkLabel: "Go home",
    linkText: "Home",
  },
};

const zhTheme = {
  nav: ZH_NAV,
  sidebar: ZH_SIDEBAR,
  socialLinks: SOCIAL_LINKS,
  outline: { level: [2, 3] as const, label: "本页目录" },
  docFooter: { prev: "上一页", next: "下一页" },
  lastUpdated: { text: "最后更新于" },
  returnToTopLabel: "回到顶部",
  sidebarMenuLabel: "目录",
  darkModeSwitchLabel: "主题",
  lightModeSwitchTitle: "切换到浅色模式",
  darkModeSwitchTitle: "切换到深色模式",
  search: {
    provider: "local" as const,
    options: {
      translations: {
        button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
        modal: {
          noResultsText: "没有找到结果",
          resetButtonTitle: "清除查询条件",
          footer: { selectText: "选择", navigateText: "切换", closeText: "关闭" },
        },
      },
    },
  },
  notFound: {
    title: "页面不存在",
    quote: "没有找到这个页面。请检查地址，或返回文档首页。",
    linkLabel: "回到首页",
    linkText: "首页",
  },
};

export default defineConfig({
  lang: "en-US",
  title: "Pling",
  description:
    "Pling (Page Intelligence) is an open capability layer that lets agents operate real web applications through explicit, auditable surfaces.",
  cleanUrls: true,
  // Demo applications are built and copied separately from the VitePress
  // bundle, so their directory URLs are valid at runtime but invisible to the
  // static dead-link pass.
  ignoreDeadLinks: [/^\/demos\//],
  srcExclude: ["legacy/**", "evidence/**", "zh/evidence/**"],
  markdown: { lineNumbers: true, languages: DOC_LANGUAGES },
  head: [
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "32x32 48x48" }],
    // Serve the dark artwork on light browser chrome, and the light artwork on
    // dark browser chrome. The `.ico` fallback uses a navy tile so it remains
    // legible in both cases.
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-dark-32.png",
        media: "(prefers-color-scheme: light)",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-light-32.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/favicon-dark-192.png",
        media: "(prefers-color-scheme: light)",
      },
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/favicon-light-192.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" }],
  ],
  sitemap: { hostname: SITE_ORIGIN },

  transformHead({ pageData }) {
    const route = routeFromRelativePath(pageData.relativePath);
    const routes = languageRoutes(route);
    return [
      ["link", { rel: "canonical", href: absoluteUrl(route) }],
      ["link", { rel: "alternate", hreflang: "en", href: absoluteUrl(routes.en) }],
      ["link", { rel: "alternate", hreflang: "zh-CN", href: absoluteUrl(routes.zh) }],
      ["link", { rel: "alternate", hreflang: "x-default", href: absoluteUrl(routes.en) }],
    ];
  },

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "Pling",
      description:
        "Pling (Page Intelligence) is an open capability layer that lets agents operate real web applications through explicit, auditable surfaces.",
      themeConfig: enTheme,
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      title: "Pling",
      description:
        "Pling（页灵）是面向真实 Web 应用的开放能力层，让 Agent 通过显式、可审计的界面能力执行任务。",
      themeConfig: zhTheme,
    },
  },

  vite: {
    plugins: [demoDataPlugin(), markdownIncludePlugin(), tutorialPreviewPlugin(), legacyRedirectsPlugin()],
    server: {
      proxy: LOCAL_DEMO_PROXY,
    },
  },

  themeConfig: {
    // VitePress names these keys after the active theme, not the artwork color.
    logo: {
      light: "/pling-mark-dark.png",
      dark: "/pling-mark-light.png",
    },
    siteTitle: "Pling",
  },
});
