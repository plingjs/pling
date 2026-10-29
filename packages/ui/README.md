# @plingjs/ui

Shared, framework-neutral UI contracts for Pling: message catalogs, translation, theme tokens,
and the subscription controller used by every adapter.

This package does not import Vue, React, or the DOM. Framework adapters consume the same contracts so the Vue, React, and Vanilla entry points cannot drift apart.

```ts
import { describePlingError, resolveLocale, resolveTheme, translate } from "@plingjs/ui";

const locale = resolveLocale("auto", { languages: ["zh-CN", "en-US"] });
const label = translate(locale, "dock.launcher.open");
const error = describePlingError(
  { code: "ACTION_NOT_FOUND", message: "Unknown action" },
  (key, params) => translate(locale, key, params),
);
const theme = resolveTheme({ mode: "light", tokens: { colorPrimary: "#2e9df7" } });
```

Adapters use `createUiController()` so runtime locale and theme changes have one implementation:

```ts
import { createUiController } from "@plingjs/ui";

const ui = createUiController({ locale: "en-US", theme: "light" });
const stop = ui.subscribe(() => render(ui.getSnapshot()));

ui.setLocale("zh-CN");
ui.setTheme({ mode: "dark", tokens: { colorPrimary: "#2e9df7" } });
stop();
ui.destroy();
```

Vue wraps the controller in a reactive shell, React reads it through `useSyncExternalStore`, and
Vanilla subscribes directly. The default locale is always `en-US`; browser-language detection only
runs when the application explicitly requests `locale: "auto"`.

## API

- `EN_US_MESSAGES` / `ZH_CN_MESSAGES`: built-in catalogs.
- `resolveLocale(locale, options)`: resolves an explicit locale or opt-in `"auto"` detection.
- `translate(locale, key, params, options)`: stable message key lookup with interpolation and English fallback.
- `ACTION_ERROR_MESSAGE_KEYS` / `RUNTIME_ERROR_MESSAGE_KEYS`: stable code → message-key maps.
- `describePlingError(error, t)`: localized error summary that always preserves the original code.
- `describePlingDiagnostic(readiness, t)`: localized configuration diagnostics from structured code/params.
- `resolveTheme(theme, options)`: resolves `light`, `dark`, or `auto` and applies token overrides.
- `themeCssVars(tokens)`: maps semantic tokens to `--pling-*` CSS variables.
- `createUiController(options, defaultLocale?)`: shared snapshot, translation, locale/theme setters and subscriptions.
- `PlingUiOptions`, `PlingTheme`, `PlingClassNames`: shared configuration types.

See [theme, locale, and accessibility](https://plingjs.dev/operations/theme-locale-and-accessibility)
for the cross-adapter contract.
