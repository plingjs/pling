# @plingjs/dom

The framework-neutral DOM execution layer shared by Pling adapters. It resolves
targets, checks whether a control can be used, performs UI primitives, handles
scrolling and visibility, and projects regions across open Shadow DOM and
same-origin iframes.

This package is primarily for adapter authors. Application code should use
`@plingjs/vue`, `@plingjs/react`, or `@plingjs/vanilla`.

```bash
npm install @plingjs/dom
```

The layer owns behaviour that must stay identical across frameworks:

- target resolution for native controls, custom components, and row actions;
- disabled, hidden, inert, and covered-state diagnostics;
- click, type, select, press, hover, scroll, and navigation primitives;
- viewport and occlusion checks, reveal, and scroll settlement;
- open Shadow DOM and same-origin iframe projection;
- adapter namespaces, coverage diagnostics, and task entry points;
- the shared compact action row (`createGuideActions`) used by every adapter.

Pling has no generic `click(selector)` escape hatch. Every executable target is
still declared by the page and checked against its current state.

## Compact action row

`createGuideActions()` renders the small row of next actions used by guided
tasks. It is a visual contract, not a task engine: the host supplies short
labels and opaque command names, and the renderer only emits the command back.

```ts
import { createGuideActions } from "@plingjs/dom";

const row = createGuideActions({
  ariaLabel: "Booking note actions",
  onCommand: (command) => runCourseCommand(command),
  items: [
    { id: "locate", label: "Point to the field", command: "focus-note", kind: "primary" },
    {
      id: "use",
      label: "Fill it in",
      preview: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      ariaLabel: "Fill in booking notes: Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      command: "apply-note",
      kind: "suggestion",
    },
  ],
});
```

A long recommendation belongs in `preview`, never in `label`: the preview is a
single ellipsised line, while the full value stays in `title`, `aria-label`, and
the conversation. Keeping the renderer here means Vue, React, and plain DOM
share one stylesheet and one set of focus and disabled states.

## Documentation

- [The page capability model](https://plingjs.dev/concepts/the-page-capability-model)
- [Execution lifecycle](https://plingjs.dev/concepts/execution-lifecycle)
- [Shadow DOM and iframe projection](https://plingjs.dev/concepts/projection-shadow-dom-and-iframes)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
