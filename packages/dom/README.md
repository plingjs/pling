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
- adapter namespaces, coverage diagnostics, and task entry points.

Pling has no generic `click(selector)` escape hatch. Every executable target is
still declared by the page and checked against its current state.

## Documentation

- [The page capability model](https://plingjs.dev/concepts/the-page-capability-model)
- [Execution lifecycle](https://plingjs.dev/concepts/execution-lifecycle)
- [Shadow DOM and iframe projection](https://plingjs.dev/concepts/projection-shadow-dom-and-iframes)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
