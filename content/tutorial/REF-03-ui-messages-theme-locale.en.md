---
id: REF-03
title: "UI messages, theme, locale"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# UI messages, theme, and locale

Pling's built-in assistant has one UI controller across Vue 3, React, Vanilla / jQuery, and Vue 2.7. It owns the framework's own labels, theme tokens, and language selection. It does not own the application's business copy.

This distinction matters. Translating a checkout button belongs to the application's i18n system. Translating “Approve”, “Clear conversation”, or “Waiting for your confirmation” in the built-in surface belongs to Pling.

## Defaults and resolution

The default locale is `en-US`. The framework does not silently follow the browser language. Browser detection is opt-in with `locale: "auto"`.

| `ui.locale` value | Result |
| --- | --- |
| omitted | `en-US` |
| `"en-US"`, `"en-GB"`, `"zh-CN"`, `"zh-TW"` | exact or base-language match in the built-in catalog |
| unsupported locale | English fallback |
| `"auto"` | first matching browser language, then English |

Locale matching is case-insensitive and treats `_` and `-` alike. A missing translation key first falls back to English, then to the key itself. Do not rely on the key as production copy.

## Options

```ts
createPling({
  ui: {
    locale: "en-US",
    theme: {
      mode: "auto",
      tokens: {
        colorPrimary: "#0f766e",
        colorPrimaryStrong: "#115e59",
        radiusLg: "16px",
      },
    },
    messages: {
      "zh-CN": {
        "chat.empty": "可以问我当前页面上的任务。",
      },
    },
    classNames: {
      dock: "product-dock",
      panel: "product-panel",
      launcher: "product-launcher",
      chat: "product-chat",
    },
  },
});
```

| Option | Purpose |
| --- | --- |
| `locale` | Built-in UI language; defaults to English |
| `theme` | `light`, `dark`, `auto`, or `{ mode, tokens }` |
| `messages` | Per-locale overrides for framework message keys |
| `classNames` | Four application-owned hooks: `dock`, `panel`, `launcher`, `chat` |

Theme tokens become CSS variables on the mounted surface, for example `--pling-color-primary`, `--pling-color-surface`, and `--pling-radius-lg`. Application CSS can use those variables without reaching into component internals.

`classNames` is not a second theme system. It exists for layout and brand selectors that cannot be expressed by color, radius, shadow, or typography tokens.

## Changing language and theme at runtime

```ts
pling.ui.setLocale("zh-CN");
pling.ui.setTheme({ mode: "dark" });
pling.ui.setTheme("auto");
```

The controller notifies mounted surfaces in place. React reads it through `useSyncExternalStore`; Vue and the vanilla dock subscribe to the same snapshot. A locale change does not recreate the agent session or lose its history.

The current implementation adds an explicit response-language instruction only for Chinese locales (`zh*`). Other locales rely on the base rule: answer in the language of the user's latest message. Switching the UI to English therefore does not force English answers. The UI locale is a default for explanations, not a restriction on the user.

## Adapter wiring

### Vue 3

```ts
const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

pling.ui.setLocale("zh-CN");
```

### React

```tsx
const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

export function App() {
  return (
    <PlingProvider pling={pling}>
      <TodoPage />
      <AgentDock />
    </PlingProvider>
  );
}
```

Use `usePlingUi()` when application controls need the current snapshot:

```tsx
const ui = usePlingUi();
ui.locale;
ui.resolvedTheme;
ui.cssVars;
```

### Vanilla / jQuery

```ts
const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

pling.dock();
pling.ui.subscribe(() => {
  document.documentElement.dataset.plingTheme = pling.ui.resolvedTheme;
});
```

### Vue 2.7

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  ui: { locale: "en-US", theme: { mode: "auto" } },
});

Vue.use(pling.plugin);
pling.dock();
```

The Vue 2.7 adapter uses the shared vanilla dock, so it exposes the same `ui` controller and language catalog. It does not have Vue 3's component slots or the Vue 3-only model-settings and debug panels.

## Language boundaries

| Text | Owner | Reason |
| --- | --- | --- |
| “Approve”, “Cancel”, “Waiting for your confirmation” | Pling catalog | Part of the built-in interaction |
| “Save order”, “Customer since 2021” | Application | Business meaning and brand voice |
| Error codes and their short explanations | Pling catalog | Stable across adapters |
| Server error details | Application or gateway | May contain domain-specific recovery instructions |
| Model answer | Model, guided by UI locale and the latest user message | The user may switch languages at any turn |

Do not send the whole application translation catalog into the model context. The UI controller only needs the keys used by the built-in surface.

`agent.config.systemPrompt` is appended after the framework rules. It can add application context, but it cannot replace the base rule that follows the user's latest message.

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Browser is Chinese but the assistant opens in English | Default is English; browser detection is opt-in | Pass `locale: "auto"` or let the user choose |
| A custom locale shows English text | The key is missing from the custom catalog | Add the key or accept the documented English fallback |
| Theme changes but the page does not | The application controls read `pling.ui.theme` instead of `resolvedTheme` | Use `resolvedTheme` for rendered colors |
| A locale switch clears the conversation | The host recreated the whole Pling instance | Call `pling.ui.setLocale()` instead |
| Custom class has no effect | It is a `classNames` slot, not an arbitrary component prop | Use `dock`, `panel`, `launcher`, or `chat` |
| Model answers in a language different from the UI | For non-Chinese locales, no extra response-language instruction is added; the latest user message still governs | Ask the user to switch languages explicitly, or add an application-level instruction that does not contradict the latest message |

## Evidence

- Shared UI controller: `packages/ui/src/controller.ts`.
- Theme token resolution: `packages/ui/src/theme.ts`.
- Locale resolution and fallback: `packages/ui/src/locale.ts`.
- Four runnable adapters with the same order-desk UI: `examples/recipes/vue3`, `examples/recipes/react`, `examples/recipes/vanilla`, `examples/recipes/vue2`.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/ui` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | None |
| Stability | Pre-1.0 alpha; a minor release may change the API |

The theme tokens and locale catalogues on this page belong to `@plingjs/ui` at this version. Adding a catalog key is compatible; renaming or removing a public key is a breaking change for applications that use it.

