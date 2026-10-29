---
id: OPS-02
title: "Theme, locale, and accessibility"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Theme, locale, and accessibility

The assistant is part of the application, not an isolated widget with its own visual language. It must follow the product's theme and language closely enough to be usable, while keeping the framework's confirmation and error messages consistent across adapters.

## Theme tokens belong to the host

Set a mode and override tokens at the application entry:

```ts
createPling({
  ui: {
    theme: {
      mode: "auto",
      tokens: {
        colorPrimary: "#0f766e",
        radiusLg: "16px",
      },
    },
  },
});
```

Use `resolvedTheme` when rendering host controls. `mode: "auto"` describes the preference; the resolved value is the theme currently in effect. A custom class name is for mounting selectors and layout, not a second theme system.

## Language has two distinct jobs

The UI locale controls labels, buttons, built-in errors, and date formatting. It does not force the model to answer in a language. The runtime follows the latest user message and adds an explicit language instruction for the supported Chinese locale. If a product wants a stricter answer-language policy, add a narrow system instruction and test it; do not assume that changing the UI locale changes the model automatically.

When a translation is missing, the assistant may fall back to English. Review the fallback in the actual interface, especially for confirmation and destructive-action copy, where an unclear translation changes a decision.

## Accessibility is a behavior, not a colour token

Check these behaviours in the host:

- every launcher and control has a name that describes its result;
- keyboard focus is visible and moves into a dialog or panel when it opens;
- closing a panel returns focus to the element that opened it;
- status, busy, and error messages are announced without moving focus unexpectedly;
- confirmation buttons have distinct labels, not two identical “OK” buttons;
- colour contrast remains sufficient in light, dark, and forced-colour modes;
- motion used for highlighting respects the user's reduced-motion preference where the host supports it.

The assistant must not obscure the only route to a pending confirmation. On a narrow screen, use a full-width panel or a dedicated decision view rather than a small overlay that covers the page action.

## Test the actual combination

Run one task in each supported language and both light and dark themes. Include an unavailable action, a failed tool call, a pending confirmation, and a long transcript. These states reveal truncation, focus traps, and unreadable tokens that a screenshot of an empty chat will not show.

See [UI messages, theme, and locale](/reference/ui-messages-theme-locale) for the option reference.
