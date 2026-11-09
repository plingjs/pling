/**
 * Shared visual implementation for the assistant surface.
 *
 * Tokens stay in `@plingjs/ui`; this module owns the framework-neutral CSS and
 * the idempotent DOM installation. Adapters render the canonical classes below
 * instead of maintaining their own visual copies.
 */
export const PLING_UI_STYLES = `
.pling-inline,
.pling-dock,
.pling-chat,
.pling-guide {
  box-sizing: border-box;
}
.pling-inline *,
.pling-inline *::before,
.pling-inline *::after,
.pling-dock *,
.pling-dock *::before,
.pling-dock *::after,
.pling-chat *,
.pling-chat *::before,
.pling-chat *::after,
.pling-guide *,
.pling-guide *::before,
.pling-guide *::after {
  box-sizing: border-box;
}
.pling-inline,
.pling-dock,
.pling-chat,
.pling-guide {
  color: var(--pling-color-text, #17181c);
  font-family: var(--pling-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
.pling-inline button,
.pling-inline input,
.pling-inline textarea,
.pling-dock button,
.pling-dock input,
.pling-dock textarea,
.pling-chat button,
.pling-chat input,
.pling-chat textarea,
.pling-guide button {
  font: inherit;
}
.pling-inline button,
.pling-dock button,
.pling-chat button,
.pling-guide button {
  cursor: pointer;
}
.pling-inline button:disabled,
.pling-dock button:disabled,
.pling-chat button:disabled,
.pling-guide button:disabled {
  cursor: not-allowed;
}

.pling-inline {
  width: 100%;
  min-width: 0;
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}
.pling-inline__panel,
.pling-dock__panel {
  position: relative;
  display: flex;
  width: 100%;
  height: var(--pling-inline-height, min(640px, calc(100vh - 96px)));
  min-height: 0;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: var(--pling-radius-lg, 14px);
  background: var(--pling-color-surface, #fff);
  box-shadow: var(--pling-shadow-panel, 0 12px 32px rgb(22 24 32 / 8%));
}
.pling-inline--dock .pling-inline__panel,
.pling-dock__panel {
  width: min(400px, calc(100vw - 48px));
  height: min(640px, calc(100vh - 120px));
}
.pling-inline--inline .pling-inline__panel,
.pling-inline--fused .pling-inline__panel {
  width: 100%;
  height: var(--pling-inline-height, min(640px, calc(100vh - 96px)));
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.pling-dock {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  font-size: 13px;
}
.pling-dock__surface {
  width: min(400px, calc(100vw - 48px));
}
.pling-dock__launcher {
  position: relative;
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 12px 0 10px;
  border: 1px solid #bfe3ff;
  border-radius: 9px;
  color: #086aa8;
  background: #f8fbff;
  box-shadow: var(--pling-shadow-launcher, 0 8px 22px rgb(22 58 86 / 12%));
  font-size: 11px;
  font-weight: 650;
}
.pling-dock__launcher:hover {
  border-color: #8bcfff;
  color: #075f96;
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-dock__launcher.is-open {
  border-color: var(--pling-color-border, #e8eaf0);
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface, #fff);
  box-shadow: none;
}
.pling-dock__launcher:focus-visible,
.pling-dock__ghost:focus-visible,
.pling-dock__tabs button:focus-visible,
.pling-chat button:focus-visible {
  outline: 2px solid var(--pling-color-primary, #2e9df7);
  outline-offset: 2px;
}
.pling-dock__dot {
  position: absolute;
  top: 5px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pling-color-warning, #765a1f);
  animation: pling-pulse 1s ease-in-out infinite;
}

.pling-dock--sidebar {
  top: 0;
  bottom: 0;
  height: 100dvh;
  gap: 0;
  pointer-events: none;
}
.pling-dock--sidebar > .pling-dock__launcher,
.pling-dock--sidebar.is-open > .pling-dock__surface {
  pointer-events: auto;
}
.pling-dock--sidebar.pling-dock--right {
  right: 0;
  left: auto;
  align-items: flex-end;
}
.pling-dock--sidebar.pling-dock--left {
  right: auto;
  left: 0;
  align-items: flex-start;
}
.pling-dock--sidebar .pling-dock__surface {
  width: var(--pling-sidebar-width, min(420px, 100vw));
  height: 100%;
}
.pling-dock--sidebar .pling-dock__surface .pling-inline__panel {
  width: 100%;
  height: 100%;
  border-top: 0;
  border-bottom: 0;
  border-radius: 0;
  box-shadow: 0 0 40px rgb(22 24 32 / 10%);
}
.pling-dock--sidebar.pling-dock--right .pling-dock__surface .pling-inline__panel {
  border-right: 0;
}
.pling-dock--sidebar.pling-dock--left .pling-dock__surface .pling-inline__panel {
  border-left: 0;
}
.pling-dock--sidebar .pling-dock__launcher {
  position: absolute;
  right: 16px;
  bottom: 24px;
  padding: 0 12px 0 10px;
  writing-mode: horizontal-tb;
}
.pling-dock--sidebar.pling-dock--left .pling-dock__launcher {
  right: auto;
  left: 16px;
}
.pling-dock--sidebar.pling-dock--launcher-center .pling-dock__launcher {
  top: 50%;
  bottom: auto;
  transform: translateY(-50%);
  padding: 14px 8px;
  writing-mode: vertical-rl;
}
.pling-dock--sidebar.pling-dock--launcher-center.pling-dock--right .pling-dock__launcher {
  right: 0;
}
.pling-dock--sidebar.pling-dock--launcher-center.pling-dock--left .pling-dock__launcher {
  left: 0;
}
.pling-dock--sidebar.is-open .pling-dock__launcher {
  display: none;
}
.pling-dock--sidebar.pling-dock--fused {
  position: relative;
  inset: auto;
  width: max-content;
  height: auto;
  min-height: 520px;
  align-self: stretch;
  gap: 12px;
  align-items: stretch;
  pointer-events: auto;
}
.pling-dock--sidebar.pling-dock--fused:not(.is-open) {
  width: auto;
  min-height: 0;
  align-self: auto;
}
.pling-dock--sidebar.pling-dock--fused:not(.is-open) .pling-dock__surface {
  display: none;
}
.pling-dock--sidebar.pling-dock--fused.pling-dock--left {
  order: -1;
}
.pling-dock--sidebar.pling-dock--fused .pling-dock__surface {
  width: var(--pling-sidebar-width, min(380px, 100vw));
  flex: 1 1 auto;
  min-height: 0;
}
.pling-dock--sidebar.pling-dock--fused .pling-dock__surface .pling-inline__panel {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: var(--pling-radius-lg, 14px);
  box-shadow: var(--pling-shadow-panel, 0 12px 32px rgb(22 24 32 / 8%));
}
.pling-dock--sidebar.pling-dock--fused .pling-dock__launcher {
  position: fixed;
  right: 22px;
  bottom: 22px;
  left: auto;
  transform: none;
  writing-mode: horizontal-tb;
}
.pling-dock--sidebar.pling-dock--fused.is-open .pling-dock__launcher {
  display: none;
}

.pling-dock__nav {
  position: relative;
  z-index: 4;
  display: flex;
  min-height: 57px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 14px 0 16px;
  border-bottom: 1px solid var(--pling-color-border, #e8eaf0);
  background: var(--pling-color-surface, #fff);
}
.pling-dock__tabs {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}
.pling-dock__tabs button {
  display: inline-flex;
  min-height: 33px;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 0;
  border-radius: 8px;
  color: var(--pling-color-text-muted, #6d7280);
  background: transparent;
  font-size: 13px;
  font-weight: 500;
}
.pling-dock__tabs button:hover {
  color: var(--pling-color-text, #17181c);
  background: var(--pling-color-surface-muted, #f7f8fa);
}
.pling-dock__tabs button.is-active {
  color: var(--pling-color-text, #17181c);
  background: #f3f4f7;
  font-weight: 650;
}
.pling-dock__badge {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  color: var(--pling-color-text-muted, #6d7280);
  background: #eef0f3;
  font-size: 11px;
  font-weight: 650;
}
.pling-dock__badge.is-bad {
  color: var(--pling-color-danger, #a73737);
  background: var(--pling-color-danger-soft, #fff7f7);
}
.pling-dock__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 1px;
}
.pling-dock__ghost {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--pling-color-text-muted, #6d7280);
  background: transparent;
}
.pling-dock__ghost:hover,
.pling-dock__ghost.is-active {
  color: var(--pling-color-text, #17181c);
  background: #f5f6f8;
}
.pling-dock__icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.pling-dock__action-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.pling-dock__actions-menu {
  position: absolute;
  z-index: 12;
  top: calc(100% + 8px);
  right: 0;
  width: min(282px, calc(100vw - 32px));
  padding: 8px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 12px;
  background: var(--pling-color-surface, #fff);
  box-shadow: 0 18px 46px rgb(22 24 32 / 17%);
}
.pling-dock__actions-menu header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px 8px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  font-weight: 650;
}
.pling-dock__actions-menu button {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 8px;
  border: 0;
  border-radius: 7px;
  color: var(--pling-color-text, #17181c);
  background: transparent;
  font-size: 12px;
  text-align: left;
}
.pling-dock__actions-menu button:hover:not(:disabled) {
  background: #f6f7f9;
}
.pling-dock__actions-menu button:disabled {
  opacity: .48;
}
.pling-dock__actions-menu button span {
  flex: none;
  font-weight: 600;
}
.pling-dock__actions-menu button small {
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  line-height: 1.45;
  text-align: right;
}
.pling-dock__running {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f2f5);
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface, #fff);
  font-size: 11px;
}
.pling-dock__running-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--pling-color-primary, #2e9df7);
  animation: pling-pulse 1s ease-in-out infinite;
}
.pling-dock__running button {
  min-height: 24px;
  margin-left: auto;
  padding: 0 8px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 7px;
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface, #fff);
  font-size: 11px;
}
.pling-dock__warn {
  margin: 10px 16px 0;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--pling-color-warning, #765a1f) 28%, transparent);
  border-radius: 8px;
  color: var(--pling-color-warning, #765a1f);
  background: var(--pling-color-warning-soft, #fffbf1);
  font-size: 11.5px;
  line-height: 1.55;
}
.pling-dock__chat {
  flex: 1;
  min-height: 0;
}
.pling-dock__status {
  flex: none;
  padding: 0 16px 8px;
}
.pling-dock__gate {
  color: var(--pling-color-warning, #765a1f);
  font-size: 11px;
}
.pling-dock__run {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 10px 16px 14px;
}
.pling-dock__diagnostics {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 2px 0 8px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f2f5);
}
.pling-dock__diagnostics .pling-dock__usage {
  flex: 1 1 180px;
  min-width: 0;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  line-height: 1.45;
}
.pling-dock__model {
  display: inline-flex;
  max-width: 180px;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface-muted, #f7f8fa);
  font-size: 11px;
  white-space: nowrap;
}
.pling-dock__model-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pling-dock__model-button {
  border: 1px solid transparent;
  font: inherit;
  cursor: pointer;
}
.pling-dock__model-button:hover,
.pling-dock__model-button.is-active {
  border-color: var(--pling-color-border, #e8eaf0);
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-dock__model-caret {
  width: 10px;
  height: 10px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  transition: transform 120ms ease;
}
.pling-dock__model-button.is-active .pling-dock__model-caret {
  transform: rotate(180deg);
}
.pling-dock__model-dot {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--pling-color-success, #17794e);
}
.pling-dock__run-section {
  flex: none;
}
.pling-dock__run-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0 4px;
}
.pling-dock__run-label {
  margin: 0;
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  font-weight: 650;
}
.pling-dock__run-toggle {
  min-height: 26px;
  padding: 2px 8px;
  border: 0;
  border-radius: 999px;
  color: var(--pling-color-text-subtle, #9297a1);
  background: none;
  font-size: 11px;
}
.pling-dock__run-toggle:hover,
.pling-dock__run-toggle.is-active {
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-surface-muted, #f7f8fa);
}
.pling-dock__activity {
  margin: 0;
  padding: 4px 0 4px 22px;
  font-size: 12px;
}
.pling-dock__row {
  margin-bottom: 8px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f2f5);
}
.pling-dock__row:last-child {
  border-bottom: 0;
}
.pling-dock__row-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}
.pling-dock__activity code {
  color: var(--pling-color-text, #17181c);
  word-break: break-all;
}
.pling-dock__state,
.pling-dock__desc,
.pling-dock__detail {
  color: var(--pling-color-text-muted, #6d7280);
}
.pling-dock__state.is-running {
  color: var(--pling-color-primary-strong, #086aa8);
}
.pling-dock__state.is-ok {
  color: var(--pling-color-success, #17794e);
}
.pling-dock__state.is-failed,
.pling-dock__state.is-blocked {
  color: var(--pling-color-danger, #a73737);
}
.pling-dock__args {
  margin: 3px 0 0;
  padding: 5px 7px;
  border-radius: 7px;
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface-muted, #f7f8fa);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}
.pling-dock__empty {
  color: var(--pling-color-text-subtle, #9297a1);
  list-style: none;
}

.pling-chat {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0;
  color: var(--pling-color-text, #17181c);
  background: var(--pling-color-surface, #fff);
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}
.pling-chat__head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f2f5);
}
.pling-chat__head strong {
  font-size: 13px;
  line-height: 1.4;
}
.pling-chat__running {
  color: var(--pling-color-primary-strong, #086aa8);
  font-size: 11px;
}
.pling-chat__stop {
  margin-left: auto;
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 7px;
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface, #fff);
  font-size: 11px;
}
.pling-chat__task-pinned {
  flex: 0 0 auto;
  max-height: min(48%, 420px);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 10px 16px 12px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f2f5);
  background: var(--pling-color-surface, #fff);
}
.pling-chat__task-pinned:empty {
  display: none;
}
.pling-chat__transcript {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 18px;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 16px 16px 12px;
  scrollbar-width: thin;
}
.pling-chat__transcript > * {
  flex: 0 0 auto;
}
.pling-chat__transcript::-webkit-scrollbar,
.pling-chat__task-pinned::-webkit-scrollbar {
  width: 6px;
}
.pling-chat__transcript::-webkit-scrollbar-thumb,
.pling-chat__task-pinned::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #dfe2e8;
}
.pling-chat__transcript.is-empty {
  align-items: stretch;
  justify-content: center;
  gap: 10px;
}
.pling-chat__empty {
  max-width: 100%;
  margin: 0;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 12.5px;
  line-height: 1.7;
  text-align: left;
}
.pling-chat__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 2px;
}
.pling-chat__quick button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 9px;
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface, #fff);
  font-size: 11.5px;
  line-height: 1.35;
  text-align: left;
}
.pling-chat__quick button:hover:not(:disabled) {
  border-color: #bfe3ff;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-chat__line {
  margin: 0;
  color: var(--pling-color-text, #17181c);
  background: transparent;
  font-size: 13.5px;
  line-height: 1.68;
  white-space: pre-wrap;
  word-break: break-word;
}
.pling-chat__line.is-user {
  width: 88%;
  margin-left: auto;
}
.pling-chat__line.is-user .pling-chat__line-body {
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  padding: 9px 12px 10px;
  border-radius: 12px 12px 4px 12px;
  background: #f4f5f7;
  font-size: 13px;
  line-height: 1.65;
}
.pling-chat__line-head {
  display: flex;
  width: 100%;
  align-items: baseline;
  flex-wrap: nowrap;
  gap: 5px;
  margin-bottom: 6px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
}
.pling-chat__line-head strong,
.pling-chat__line-head span {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
}
.pling-chat__line-head time {
  flex: 0 0 auto;
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  font-weight: 400;
  white-space: nowrap;
}
.pling-chat__line.is-user .pling-chat__line-head {
  justify-content: flex-end;
}
.pling-chat__line.is-assistant .pling-chat__line-head strong,
.pling-chat__line.is-final .pling-chat__line-head strong {
  color: var(--pling-color-text, #17181c);
}
.pling-chat__line-body {
  margin: 0;
  white-space: pre-wrap;
}
.pling-chat__line .markdown {
  white-space: normal;
}
.pling-chat__line .markdown p {
  margin: 0 0 0.55em;
}
.pling-chat__line .markdown p:last-child {
  margin-bottom: 0;
}
.pling-chat__line .markdown h1,
.pling-chat__line .markdown h2,
.pling-chat__line .markdown h3,
.pling-chat__line .markdown h4,
.pling-chat__line .markdown h5,
.pling-chat__line .markdown h6 {
  margin: 0.25em 0 0.5em;
  line-height: 1.35;
}
.pling-chat__line .markdown ul,
.pling-chat__line .markdown ol {
  margin: 0.35em 0;
  padding-left: 1.5em;
}
.pling-chat__line .markdown blockquote {
  margin: 0.5em 0;
  padding-left: 0.75em;
  border-left: 3px solid var(--pling-color-border, #e8eaf0);
  color: var(--pling-color-text-muted, #6d7280);
}
.pling-chat__line .markdown pre {
  overflow-x: auto;
  margin: 0.5em 0;
  padding: 8px;
  border-radius: 7px;
  background: var(--pling-color-surface-muted, #f7f8fa);
}
.pling-chat__line .markdown code {
  padding: 0.08em 0.28em;
  border-radius: 4px;
  background: var(--pling-color-surface-muted, #f1f2f5);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  font-size: 0.94em;
}
.pling-chat__line .markdown pre code {
  padding: 0;
  background: transparent;
  white-space: pre;
}
.pling-chat__line .markdown a {
  color: var(--pling-color-primary-strong, #086aa8);
  text-decoration: underline;
}
.pling-chat__line .markdown table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.pling-chat__line .markdown th,
.pling-chat__line .markdown td {
  padding: 3px 6px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  text-align: left;
}
.pling-chat__line.is-notice,
.pling-chat__line.is-error,
.pling-chat__line.is-blocked,
.pling-chat__line.is-call,
.pling-chat__line.is-result,
.pling-chat__line.is-executing {
  padding: 9px 11px;
  border-left: 2px solid var(--pling-color-border, #d8dbe3);
  border-radius: 0 8px 8px 0;
  background: #f8f9fa;
  font-size: 12px;
}
.pling-chat__line.is-error {
  border-left-color: #e8aaaa;
  color: var(--pling-color-danger, #a73737);
  background: var(--pling-color-danger-soft, #fff7f7);
}
.pling-chat__line.is-notice,
.pling-chat__line.is-blocked {
  border-left-color: #e7c37a;
  color: var(--pling-color-warning, #765a1f);
  background: var(--pling-color-warning-soft, #fffbf1);
}
.pling-chat__line.is-call,
.pling-chat__line.is-result {
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
}
.pling-chat__line.is-result.is-ok {
  color: var(--pling-color-success, #17794e);
}
.pling-chat__line.is-executing {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--pling-color-text-muted, #6d7280);
}
.pling-chat__executing-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--pling-color-primary, #2e9df7);
  animation: pling-pulse 1s ease-in-out infinite;
}
.pling-chat__args {
  margin-left: 6px;
  color: var(--pling-color-text-subtle, #9297a1);
}
.pling-chat__resume,
.pling-chat__confirm,
.pling-chat__handoff {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 10px;
  background: var(--pling-color-surface-muted, #f7f8fa);
  font-size: 12px;
}
.pling-chat__resume strong,
.pling-chat__confirm .pling-chat__ask strong,
.pling-chat__handoff .pling-chat__ask strong {
  color: var(--pling-color-text, #17181c);
  font-size: 12.5px;
}
.pling-chat__resume-hint,
.pling-chat__handoff-hint,
.pling-chat__handoff-reason,
.pling-chat__confirm-desc {
  margin: 0;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11.5px;
  line-height: 1.55;
}
.pling-chat__confirm {
  border-color: color-mix(in srgb, var(--pling-color-warning, #765a1f) 28%, var(--pling-color-border, #e8eaf0));
  background: var(--pling-color-warning-soft, #fffbf1);
}
.pling-chat__confirm.is-danger {
  border-color: color-mix(in srgb, var(--pling-color-danger, #a73737) 28%, var(--pling-color-border, #e8eaf0));
  background: var(--pling-color-danger-soft, #fff7f7);
}
.pling-chat__ask {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pling-chat__ask code {
  color: var(--pling-color-text-muted, #6d7280);
  font-family: var(--pling-font-family-mono, ui-monospace, monospace);
  font-size: 11px;
}
.pling-chat__handoff-steps {
  display: grid;
  gap: 4px;
  margin: 2px 0;
  padding: 0;
  list-style: none;
}
.pling-chat__handoff-steps li {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11.5px;
  line-height: 1.55;
}
.pling-chat__handoff-steps li.is-current {
  color: var(--pling-color-text, #17181c);
  font-weight: 600;
}
.pling-chat__handoff-steps li.is-done {
  color: var(--pling-color-success, #17794e);
  text-decoration: line-through;
}
.pling-chat__handoff-num {
  display: inline-grid;
  width: 16px;
  height: 16px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  font-size: 11px;
}
.pling-chat__answers {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}
.pling-chat__answers button {
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 7px;
  color: var(--pling-color-text, #17181c);
  background: var(--pling-color-surface, #fff);
  font-size: 11px;
}
.pling-chat__answers button:hover:not(:disabled) {
  border-color: #bfe3ff;
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-chat__answers button.reject {
  color: var(--pling-color-danger, #a73737);
}

.pling-chat__composer {
  flex: none;
  padding: 10px 16px 14px;
  background: var(--pling-color-surface, #fff);
}
.pling-chat__composer-box {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: 52px;
  padding: 8px 44px 8px 12px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 14px;
  background: var(--pling-color-surface, #fff);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.pling-chat__composer-box:focus-within {
  border-color: #8bcfff;
  box-shadow: 0 0 0 3px rgb(46 157 247 / 10%);
}
.pling-chat__composer input,
.pling-chat__composer textarea {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  max-height: 150px;
  padding: 6px 0;
  border: 0;
  outline: 0;
  color: var(--pling-color-text, #17181c);
  background: transparent;
  font-size: 13px;
  line-height: 22px;
}
.pling-chat__composer textarea {
  height: 44px;
  resize: none;
  overflow-y: hidden;
}
.pling-chat__composer input::placeholder,
.pling-chat__composer textarea::placeholder {
  color: var(--pling-color-text-subtle, #9297a1);
}
.pling-chat__send {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 9px;
  color: var(--pling-color-on-primary, #fff);
  background: var(--pling-color-primary, #2e9df7);
}
.pling-chat__send:hover:not(:disabled) {
  background: var(--pling-color-primary-strong, #086aa8);
}
.pling-chat__send:disabled {
  opacity: .38;
}
.pling-chat__send svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pling-guide {
  display: grid;
  width: 100%;
  gap: 12px;
  color: var(--pling-color-text, #17181c);
  font-size: 13px;
}
.pling-guide__welcome {
  display: block;
}
.pling-guide__welcome::before {
  display: block;
  margin-bottom: 6px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  font-weight: 650;
  content: "Pling";
}
.pling-guide__avatar {
  display: none;
}
.pling-guide__bubble,
.pling-guide__welcome.has-avatar .pling-guide__bubble {
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: var(--pling-color-text, #17181c);
  background: transparent;
  box-shadow: none;
  font-size: 13.5px;
  line-height: 1.68;
}
.pling-guide__card {
  overflow: hidden;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 14px;
  background: var(--pling-color-surface, #fff);
  box-shadow: 0 6px 18px rgb(31 76 116 / 4%);
}
.pling-guide__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 13px 10px;
  border-bottom: 1px solid var(--pling-color-border-muted, #f1f2f5);
  background: var(--pling-color-surface, #fff);
}
.pling-guide__title-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.pling-guide__icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  font-size: 13px;
  font-weight: 750;
}
.pling-guide__title {
  margin: 0;
  color: var(--pling-color-text, #17181c);
  font-size: 15px;
  font-weight: 680;
  line-height: 1.35;
  letter-spacing: -.01em;
}
.pling-guide__subtitle {
  margin: 3px 0 0;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  line-height: 1.45;
}
.pling-guide__head-actions,
.pling-guide__rail-meta {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}
.pling-guide__state,
.pling-guide__rail-state {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
.pling-guide__state.is-done,
.pling-guide__rail-state.is-done {
  color: var(--pling-color-success, #17794e);
  background: var(--pling-color-success-soft, #eaf8f0);
}
.pling-guide__cancel,
.pling-guide__rail-cancel {
  display: grid;
  min-width: 24px;
  min-height: 24px;
  place-items: center;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--pling-color-text-muted, #6d7280);
  background: transparent;
  font-size: 11px;
}
.pling-guide__cancel:hover,
.pling-guide__rail-cancel:hover {
  border-color: var(--pling-color-border, #e8eaf0);
  background: var(--pling-color-surface-muted, #f7f8fa);
}
.pling-guide__progress {
  height: 3px;
  background: var(--pling-color-border-muted, #f1f2f5);
}
.pling-guide__progress > span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--pling-color-primary, #2e9df7);
  transition: width 220ms ease;
}
.pling-guide__body {
  padding: 11px 13px 13px;
}
.pling-guide__steps {
  display: grid;
  gap: 2px;
  margin: 0 0 11px;
  padding: 0;
  list-style: none;
}
.pling-guide__step {
  position: relative;
  display: grid;
  min-height: 34px;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 12.5px;
  line-height: 1.45;
}
.pling-guide__step:not(:last-child)::before {
  position: absolute;
  top: 27px;
  bottom: -7px;
  left: 10px;
  width: 1px;
  background: #e5edf5;
  content: "";
}
.pling-guide__dot {
  position: relative;
  z-index: 1;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 50%;
  color: var(--pling-color-text-subtle, #9297a1);
  background: #fff;
  font-size: 11px;
  font-weight: 700;
}
.pling-guide__step.is-current {
  color: var(--pling-color-text, #17181c);
  font-weight: 620;
}
.pling-guide__step.is-current .pling-guide__dot {
  border-color: #69bdfb;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  box-shadow: 0 0 0 3px rgb(46 157 247 / 9%);
}
.pling-guide__step.is-done {
  color: var(--pling-color-text-muted, #6d7280);
}
.pling-guide__step.is-done .pling-guide__dot {
  border-color: #a7d8ff;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-guide__step small {
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  font-weight: 500;
}
.pling-guide__panel-title {
  margin: 0 0 5px;
  color: var(--pling-color-text, #17181c);
  font-size: 14px;
  font-weight: 680;
  line-height: 1.4;
}
.pling-guide__panel-copy {
  margin: 0 0 12px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 12.5px;
  line-height: 1.6;
}
.pling-guide__summary,
.pling-guide__handoff {
  margin-top: 2px;
  padding: 10px 11px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 9px;
  background: var(--pling-color-surface-muted, #f7f8fa);
  font-size: 12px;
  line-height: 1.6;
}
.pling-guide__summary > strong,
.pling-guide__handoff > strong {
  display: block;
  color: var(--pling-color-text, #17181c);
}
.pling-guide__rows {
  display: grid;
  gap: 7px;
  margin: 9px 0 0;
}
.pling-guide__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  color: var(--pling-color-text-muted, #6d7280);
}
.pling-guide__row-main,
.pling-guide__row-value {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pling-guide__row-main {
  flex: 1 1 auto;
}
.pling-guide__row-value {
  flex: 0 1 auto;
  justify-content: flex-end;
}
.pling-guide__row b {
  color: var(--pling-color-text, #17181c);
  font-weight: 630;
  text-align: right;
}
.pling-guide__row.is-suggested b {
  color: var(--pling-color-primary-strong, #086aa8);
}
.pling-guide__row.is-missing b {
  color: var(--pling-color-text-subtle, #9297a1);
}
.pling-guide__badge {
  padding: 2px 6px;
  border-radius: 999px;
  color: var(--pling-color-text-muted, #6d7280);
  background: #eef2f6;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.4;
  white-space: nowrap;
}
.pling-guide__badge.is-current {
  color: var(--pling-color-success, #17794e);
  background: var(--pling-color-success-soft, #eaf8f0);
}
.pling-guide__badge.is-suggested {
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-guide__badge.is-missing {
  color: var(--pling-color-warning, #765a1f);
  background: var(--pling-color-warning-soft, #fffbf1);
}
.pling-guide__row-note {
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  line-height: 1.45;
}
.pling-guide__row-action,
.pling-guide__primary,
.pling-guide__secondary {
  min-height: 28px;
  padding: 0 9px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 620;
}
.pling-guide__row-action,
.pling-guide__secondary {
  border: 1px solid var(--pling-color-border, #e8eaf0);
  color: var(--pling-color-text-muted, #6d7280);
  background: var(--pling-color-surface, #fff);
}
.pling-guide__row-action:hover,
.pling-guide__secondary:hover {
  border-color: #bfe3ff;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
}
.pling-guide__primary {
  border: 1px solid var(--pling-color-primary, #2e9df7);
  color: var(--pling-color-on-primary, #fff);
  background: var(--pling-color-primary, #2e9df7);
}
.pling-guide__primary:hover:not(:disabled) {
  border-color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-strong, #086aa8);
}
.pling-guide__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
}
.pling-guide__error {
  margin: 8px 0 0;
  padding: 8px 9px;
  border-radius: 8px;
  color: var(--pling-color-danger, #a73737);
  background: var(--pling-color-danger-soft, #fff7f7);
  font-size: 11.5px;
  line-height: 1.5;
}
.pling-guide__result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid #cfe9da;
  border-radius: 10px;
  background: #f3fbf6;
}
.pling-guide__check {
  display: grid;
  width: 25px;
  height: 25px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--pling-color-success, #17794e);
  font-size: 13px;
}
.pling-guide__result strong,
.pling-guide__result span {
  display: block;
}
.pling-guide__result strong {
  font-size: 12.5px;
  line-height: 1.4;
}
.pling-guide__result span {
  margin-top: 3px;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11.5px;
  line-height: 1.55;
}
.pling-guide__note {
  margin: 8px 1px 0;
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}
.pling-guide--rail {
  gap: 0;
}
.pling-guide__rail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.pling-guide__rail-title {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 9px;
}
.pling-guide__rail-icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  font-size: 12px;
  font-weight: 750;
}
.pling-guide__rail-heading {
  margin: 0;
  color: var(--pling-color-text, #17181c);
  font-size: 14.5px;
  font-weight: 680;
  line-height: 1.35;
  letter-spacing: -.01em;
}
.pling-guide__rail-subtitle {
  margin: 2px 0 0;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  line-height: 1.4;
}
.pling-guide__rail-scroll {
  margin-top: 7px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.pling-guide__rail-scroll::-webkit-scrollbar {
  display: none;
}
.pling-guide__rail-scroll.can-scroll-right {
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent);
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent);
}
.pling-guide__rail-scroll.can-scroll-left {
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 100%);
}
.pling-guide__rail-scroll.can-scroll-left.can-scroll-right {
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
}
.pling-guide__rail {
  display: flex;
  width: max-content;
  align-items: flex-start;
  gap: 0;
  margin: 0;
  padding: 1px 1px 2px;
  list-style: none;
}
.pling-guide__rail-item {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}
.pling-guide__rail-node {
  display: flex;
  width: 64px;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0;
  border: 0;
  color: var(--pling-color-text-subtle, #9297a1);
  background: none;
  text-align: center;
}
.pling-guide__rail-node:hover .pling-guide__rail-dot {
  border-color: #9dcff1;
  color: var(--pling-color-primary-strong, #086aa8);
}
.pling-guide__rail-dot {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid #d8e5f1;
  border-radius: 50%;
  color: var(--pling-color-text-subtle, #9297a1);
  background: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}
.pling-guide__rail-label {
  max-width: 64px;
  overflow: hidden;
  color: var(--pling-color-text-muted, #6d7280);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pling-guide__rail-flag {
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  line-height: 1.3;
}
.pling-guide__rail-item.is-filled .pling-guide__rail-dot {
  border-color: #b5e4cb;
  color: var(--pling-color-success, #17794e);
  background: var(--pling-color-success-soft, #eaf8f0);
}
.pling-guide__rail-item.is-current .pling-guide__rail-dot {
  border-color: #69bdfb;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  box-shadow: 0 0 0 3px rgb(46 157 247 / 10%);
}
.pling-guide__rail-item.is-current .pling-guide__rail-label {
  color: var(--pling-color-text, #17181c);
  font-weight: 650;
}
.pling-guide__rail-item.is-skipped .pling-guide__rail-dot {
  border-style: dashed;
  color: var(--pling-color-text-subtle, #9297a1);
  background: #fff;
}
.pling-guide__rail-item.is-suggested:not(.is-filled):not(.is-skipped) .pling-guide__rail-dot {
  border-style: dashed;
  border-color: #8bcfff;
}
.pling-guide__rail-item.is-required .pling-guide__rail-flag {
  color: #9a6a16;
}
.pling-guide__rail-arrow {
  margin: 0 1px 18px;
  color: #c6d3e0;
  font-size: 13px;
  line-height: 1;
}
.pling-guide__rail-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 9px;
}
.pling-guide--compact {
  gap: 6px;
}
.pling-guide__compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 11px;
  border: 1px solid var(--pling-color-border, #e8eaf0);
  border-radius: 10px;
  background: var(--pling-color-surface, #fff);
}
.pling-guide__compact-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.pling-guide__compact-icon {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  color: var(--pling-color-primary-strong, #086aa8);
  background: var(--pling-color-primary-soft, #eaf6ff);
  font-size: 11px;
  font-weight: 750;
}
.pling-guide__compact-copy {
  min-width: 0;
}
.pling-guide__compact-heading,
.pling-guide__compact-subtitle {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pling-guide__compact-heading {
  color: var(--pling-color-text, #17181c);
  font-size: 12.5px;
  font-weight: 680;
  line-height: 1.35;
}
.pling-guide__compact-subtitle {
  margin-top: 1px;
  color: var(--pling-color-text-subtle, #9297a1);
  font-size: 11px;
  line-height: 1.35;
}
.pling-guide__compact-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

@keyframes pling-pulse {
  50% { opacity: .25; }
}
@media (prefers-reduced-motion: reduce) {
  .pling-dock__dot,
  .pling-dock__running-dot,
  .pling-chat__executing-dot {
    animation: none;
  }
}
@media (max-width: 720px) {
  .pling-dock--sidebar {
    top: auto;
    right: 12px;
    bottom: 12px;
    left: auto;
    width: auto;
    height: auto;
  }
  .pling-dock--sidebar .pling-dock__surface {
    width: min(400px, calc(100vw - 24px));
    height: auto;
  }
  .pling-dock--sidebar .pling-dock__surface .pling-inline__panel {
    height: min(640px, calc(100dvh - 72px));
    border: 1px solid var(--pling-color-border, #e8eaf0);
    border-radius: var(--pling-radius-lg, 14px);
    box-shadow: var(--pling-shadow-panel, 0 12px 32px rgb(22 24 32 / 8%));
  }
  .pling-dock--sidebar .pling-dock__launcher {
    position: relative;
    inset: auto;
    transform: none;
    padding: 0 12px 0 10px;
    writing-mode: horizontal-tb;
  }
  .pling-dock--sidebar.pling-dock--fused {
    position: fixed;
    right: 12px;
    bottom: 12px;
    left: auto;
    width: auto;
    min-height: 0;
  }
  .pling-dock--sidebar.pling-dock--fused .pling-dock__surface {
    width: min(400px, calc(100vw - 24px));
    height: auto;
  }
  .pling-dock--sidebar.pling-dock--fused .pling-dock__surface .pling-inline__panel {
    height: min(640px, calc(100dvh - 72px));
  }
  .pling-guide__actions,
  .pling-guide__rail-actions {
    flex-wrap: wrap;
  }
  .pling-guide__primary,
  .pling-guide__secondary {
    flex: 1 1 auto;
  }
}
`;

const STYLE_ELEMENT_ID = "pling-ui-styles";

/** Install the shared surface stylesheet once per document. */
export function ensurePlingStyles(targetDocument: Document | null = typeof document === "undefined" ? null : document): void {
  if (!targetDocument || targetDocument.getElementById(STYLE_ELEMENT_ID)) return;
  const style = targetDocument.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.dataset.plingStyles = "true";
  style.textContent = PLING_UI_STYLES;
  targetDocument.head.append(style);
}
