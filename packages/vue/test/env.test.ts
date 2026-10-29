import ts from "typescript";
import { describe, expect, it } from "vitest";
import source from "../src/env.ts?raw";

/**
 * 守着 `readViteEnv` 的写法约束（见 `src/env.ts` 的注释）。
 *
 * Vite 是按**编译后的源码文本**匹配 `import.meta.env` 来决定要不要注入 env 的。
 * 一旦写成 `const meta = import.meta; meta.env`，编译后字面量就没了，注入不发生，
 * 应用的 `.env.local` 静默失效（面板只会说「没有配置模型地址」，非常难查）。
 *
 * 所以这里不用肉眼看源码，而是用 tsc 把 `env.ts` 编译一遍，直接看产物。
 */
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    removeComments: true,
  },
}).outputText;

describe("readViteEnv 的写法约束", () => {
  it("编译后保留 import.meta.env 字面量（Vite 靠它决定注入）", () => {
    expect(compiled).toContain("import.meta.env");
  });

  it("编译后不出现裸的 import.meta（只有 import.meta.env 才算数）", () => {
    expect(compiled.match(/import\.meta(?!\.env)/g) ?? []).toEqual([]);
  });

  it("拿不到 env 时返回空对象，而不是抛错", () => {
    expect(compiled).toContain("?? {}");
  });
});
