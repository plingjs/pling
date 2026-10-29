---
id: C-14
title: "Projection: Shadow DOM and iframes"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Projection: Shadow DOM and iframes

The DOM a user sees is not always the DOM a simple `document.querySelector()` traverses. Shadow roots create a composed tree, and same-origin iframes create another document with its own viewport and coordinate space. Projection is the work of making actions, regions, hit testing, scrolling, and visibility agree on which element the user is actually looking at.

## What projection changes

Inside an open shadow root, an element remains in the current document, but its parent chain crosses a `ShadowRoot` boundary to the host. Queries must use the composed tree; visibility and overlap must account for the top-level viewport; a `v-scope` on the host should remain an ancestor for nested declarations.

For a same-origin iframe, the inner document has its own globals and layout. The parent must explicitly share a page runtime with the named frame. The child does not automatically become part of the parent just because the browser can access it. Coordinates must be mapped through the frame's box, including CSS transforms where supported.

## Supported boundaries

| Boundary | Behavior |
| --- | --- |
| Open shadow root | Composed-tree queries; host scopes remain visible |
| Closed shadow root | Not traversed |
| Same-origin iframe with explicit sharing | Shared registry and projection coordinates |
| Cross-origin iframe | Not traversed |
| Multiple framework islands | Separate adapters; `namespace` prevents id collisions |

The framework deliberately does not scan every iframe or open every shadow root. Explicit sharing makes ownership and lifecycle visible. A child frame that reuses the parent's runtime still declares its own actions and must not overwrite unrelated ids.

## Geometry is part of correctness

An element can exist, be enabled, and still be unreachable because a sticky header covers it, its frame is clipped, or a scroll container has moved it out of view. Availability therefore includes more than a selector match. The projection layer checks the element's composed position against the top-level viewport and the relevant scroll chain.

This is why a button that works in a unit test can fail in a nested frame. A synthetic click can call the event handler while a real user cannot reach the target. The executor should report the obstruction or offscreen state rather than silently claiming interaction.

## Namespaces are not security boundaries

Two framework islands can declare the same local action id. A namespace prefixes declarations so `draft` becomes `react/draft` or `vue/draft` and one island's executor does not accidentally run another's action. That prevents collisions; it does not grant or deny permission. The current user session, delegated scope, and business backend still decide who may perform the operation.

Likewise, an iframe boundary is not automatically a security boundary for business data. If the parent explicitly shares a page runtime, the child can be part of the same capability surface. If the content is untrusted, do not share the runtime; isolate it at the origin and application boundary.

## Testing projection

For a shadow-root component, verify that a nested action inherits the host region, that hit testing reaches the correct button, and that a dialog inside the shadow root blocks actions behind it. For an iframe, verify explicit sharing, coordinate mapping at different frame sizes, scrolling inside the frame, and failure when sharing is absent.

Do not test only by calling framework APIs directly. Exercise the path a model or external agent takes: describe the page, invoke the visible capability, and verify the resulting business state. Projection bugs are often only visible when selection, geometry, and execution are combined.

See [Continuity and projection](/reference/continuity-and-projection) for adapter APIs and the documented limitations.
