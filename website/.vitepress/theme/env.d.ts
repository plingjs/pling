declare module "virtual:pling-demo-data" {
  export interface DemoCodeLine {
    kind?: "import" | "setup" | "declare" | "entry";
    anchor?: string;
  }

  export interface DemoFile {
    path: string;
    label: string;
    role: string;
    roleZh?: string;
    lang: string;
    scope?: "workspace";
    source: string;
    html: string;
    lines: readonly DemoCodeLine[];
  }

  export interface DemoGuideStep {
    title: string;
    titleZh?: string;
    body: string | readonly string[];
    bodyZh?: string | readonly string[];
    file: string;
    match: string;
    lines?: number;
  }

  export interface DemoGuide {
    title: string;
    titleZh?: string;
    intro: string | readonly string[];
    introZh?: string | readonly string[];
    steps: readonly DemoGuideStep[];
    note?: string;
    noteZh?: string;
  }

  export interface DemoExample {
    id: string;
    title: string;
    titleZh?: string;
    eyebrow: string;
    eyebrowZh?: string;
    summary: string;
    summaryZh?: string;
    url: string;
    liveQuery?: string;
    source: string;
    run: string;
    open: string;
    files: readonly DemoFile[];
    focus?: Record<string, { selector: string; match: string }>;
    guide: DemoGuide;
    stats: { files: number; declared: number; entrypoints: number };
  }

  export const DEMO_EXAMPLES: readonly DemoExample[];
}

