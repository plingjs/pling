# @plingjs/ui

Shared interface contracts for Pling adapters: locale catalogs, message lookup,
error localization, theme tokens, CSS variables, and class-name hooks.

Adapters use the same controller so changing language or theme updates the
existing assistant UI without remounting it. The default locale is English;
browser-language detection is opt-in with `locale: "auto"`.

```bash
npm install @plingjs/ui
```

```ts
import { createUiController } from "@plingjs/ui";

const ui = createUiController({ locale: "en-US", theme: "light" });
const unsubscribe = ui.subscribe(() => render(ui.getSnapshot()));

ui.setLocale("zh-CN");
ui.setTheme({ mode: "dark", tokens: { colorPrimary: "#2e9df7" } });

unsubscribe();
ui.destroy();
```

Most applications configure this through an adapter's `ui` option instead of
calling the controller directly.

## Documentation

- [UI messages, theme, and locale](https://plingjs.dev/reference/ui-messages-theme-locale)
- [Theme, locale, and accessibility](https://plingjs.dev/operations/theme-locale-and-accessibility)
- [API reference](https://plingjs.dev/reference/api/shared)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
