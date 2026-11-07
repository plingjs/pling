/** 原生问答入口的样式；类名与 Vue / React 浮窗保持一致。 */
export const DOCK_STYLES = `
.pling-dock{position:fixed;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;color:var(--pling-color-text,#0f172a);font-family:var(--pling-font-family,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif);font-size:13px;text-align:left}
.pling-dock *{box-sizing:border-box}
.pling-dock [hidden]{display:none!important}
.pling-dock button,.pling-dock input{font:inherit}
.pling-dock button{cursor:pointer}
.pling-dock__panel{display:flex;flex-direction:column;gap:6px;width:min(400px,calc(100vw - 48px));height:min(600px,calc(100vh - 120px));padding:12px;border:1px solid var(--pling-color-border,#e3e8f0);border-radius:var(--pling-radius-lg,12px);background:var(--pling-color-surface,#fff);box-shadow:var(--pling-shadow-panel,0 18px 40px rgb(15 23 42 / 16%))}
.pling-dock__warn{margin:0;padding:8px 10px;border:1px solid #fdba74;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12px}
.pling-dock__quick{display:flex;flex-wrap:wrap;gap:6px}
.pling-dock__quick button{padding:3px 8px;border:1px solid var(--pling-color-border,#cbd5e1);border-radius:999px;background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#334155);font-size:12px;cursor:pointer}
.pling-dock__quick button:disabled{opacity:.5;cursor:not-allowed}
.pling-dock__nav{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--pling-color-border,#e3e8f0)}
.pling-dock__actions{display:flex;flex:none;align-items:center;gap:2px}
.pling-dock__model{display:inline-flex;max-width:150px;align-items:center;gap:5px;padding:1px 6px;border:1px solid transparent;border-radius:999px;background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#64748b);font-size:11px;white-space:nowrap}
.pling-dock__gate{color:#b45309;font-size:11px;white-space:nowrap}
.pling-dock__ghost{display:inline-grid;width:26px;height:26px;place-items:center;padding:0;border:0;border-radius:7px;background:none;color:#64748b}
.pling-dock__ghost:hover{background:#f1f5f9;color:#0f172a}
.pling-dock__ghost:focus-visible{outline:2px solid #2e9df7;outline-offset:1px}
.pling-dock__icon{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.pling-dock__tabs{display:flex;min-width:0;gap:4px;margin:2px 0 0}
.pling-dock__tabs button{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:0;border-bottom:2px solid transparent;background:none;color:#64748b;font-size:12px}
.pling-dock__tabs button.is-active{border-bottom-color:#2e9df7;color:#0369a1}
.pling-dock__badge{padding:0 5px;border-radius:999px;background:#eff6ff;color:#0369a1;font-size:11px}
.pling-dock__badge.is-bad{background:#fee2e2;color:#b91c1c}
.pling-dock__role{margin:0 0 2px;padding:5px 8px;border:1px solid #dbe7f5;border-radius:7px;background:#f8fbff;color:#475569;font-size:11px;line-height:1.45}
.pling-dock__role.is-readonly{border-color:#bae6fd;background:#f0f9ff;color:#0369a1}
.pling-dock__role.is-lost{border-color:#fdba74;background:#fff7ed;color:#9a3412}
.pling-dock__body{display:flex;flex:1;min-height:0}
.pling-dock__view{display:flex;flex:1;min-height:0}
.pling-dock__view[hidden]{display:none}
.pling-dock__activity-view{flex-direction:column;gap:8px;overflow:auto;padding-right:2px}
.pling-dock__run-section{flex:none}
.pling-dock__activity{flex:none;margin:0;padding:4px 4px 4px 22px;font-size:12px}
.pling-dock__diagnostics{display:flex;flex:none;align-items:center;flex-wrap:wrap;gap:4px 8px;padding:2px 4px 6px;border-bottom:1px solid #f1f5f9}
.pling-dock__diagnostics .pling-dock__usage{flex:1 1 180px;min-width:0;line-height:1.45}
.pling-dock__row{margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #f1f5f9}
.pling-dock__row:last-child{border-bottom:0}
.pling-dock__row-head{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:0}
.pling-dock__activity code{color:#0f172a;word-break:break-all}
.pling-dock__state{flex:none;color:#64748b}
.pling-dock__state.is-running{color:#0369a1}
.pling-dock__state.is-ok{color:#15803d}
.pling-dock__state.is-failed,.pling-dock__state.is-blocked{color:#b91c1c}
.pling-dock__desc{color:#64748b}
.pling-dock__args{margin:2px 0 0;padding:4px 6px;border-radius:6px;background:#f8fafc;color:#334155;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;white-space:pre-wrap;word-break:break-all}
.pling-dock__detail{margin:2px 0 0;color:#94a3b8}
.pling-dock__activity .pling-dock__empty{margin-left:-16px;color:#94a3b8;line-height:1.6;list-style:none}
.pling-dock__tasks{flex-direction:column;gap:6px;overflow:auto}
.pling-dock__tasks-intro{margin:0;color:#64748b;font-size:11px;line-height:1.5}
.pling-dock__task-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.pling-dock__task{padding:8px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
.pling-dock__task.is-current{border-color:#7dd3fc;background:#f8fbff}
.pling-dock__task-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.pling-dock__task-head strong{font-size:12px;line-height:1.4;word-break:break-word}
.pling-dock__tag{flex:none;padding:1px 6px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:10px;white-space:nowrap}
.pling-dock__tag.is-owner{background:#dcfce7;color:#15803d}
.pling-dock__tag.is-remote{background:#fef3c7;color:#b45309}
.pling-dock__meta{margin:3px 0 0;color:#94a3b8;font-size:10px;font-variant-numeric:tabular-nums}
.pling-dock__task-actions{display:flex;gap:6px;margin-top:6px}
.pling-dock__task-actions button{padding:2px 9px;border:1px solid #bae6fd;border-radius:6px;background:#f0f9ff;color:#0369a1;font-size:11px}
.pling-dock__task-actions button:disabled{opacity:.5;cursor:not-allowed}
.pling-dock__task-error,.pling-dock__task-empty{margin:0;padding:8px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:11px;line-height:1.5;list-style:none}
.pling-dock__task-empty{background:#f8fafc;color:#94a3b8}
.pling-dock__usage{margin:0;color:#94a3b8;font-size:11px;font-variant-numeric:tabular-nums}
.pling-dock__launcher{position:relative;padding:10px 16px;border:0;border-radius:999px;background:#2e9df7;color:#fff;font-size:13px;box-shadow:0 10px 24px rgb(46 157 247 / 32%)}
.pling-dock__launcher.is-open{background:#475569;box-shadow:none}
.pling-dock__status{display:flex;flex:none;align-items:center;flex-wrap:wrap;gap:4px 8px;min-height:18px}
.pling-dock__dot{position:absolute;top:6px;right:8px;width:7px;height:7px;border-radius:50%;background:#fbbf24;animation:pling-dock-pulse 1s ease-in-out infinite}
.pling-chat{display:flex;flex-direction:column;gap:8px;flex:1;height:100%;min-height:0;padding:12px;border:1px solid var(--pling-color-border,#ddd);border-radius:var(--pling-radius-md,8px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text,#0f172a);font-size:13px;line-height:1.5;text-align:left}
.pling-chat__head{display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid #eef2f7}
.pling-chat__running{color:#0369a1;font-size:12px}
.pling-chat__stop{margin-left:auto;padding:2px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569}
.pling-chat__transcript{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px}
.pling-chat__pending{display:contents}
.pling-chat__line{margin:0;padding:6px 8px;border-left:3px solid #dbe7f5;border-radius:6px;white-space:pre-wrap;word-break:break-word}
.pling-chat__line.is-user{border-color:#7dd3fc;background:#f0f9ff}
.pling-chat__line.is-assistant{border-color:var(--pling-color-border,#ddd)}
.pling-chat__line.is-final{border-color:#86efac;background:#f0fdf4}
.pling-chat__line.is-markdown{white-space:normal}
.pling-chat__line.is-notice{border-color:#fde68a;background:#fffbeb;color:#92400e;font-size:12px}
.pling-chat__line.is-error{border-color:#fca5a5;background:#fef2f2;color:#b91c1c}
.pling-chat__line.is-blocked{border-color:#fdba74;background:#fff7ed;color:#9a3412}
.pling-chat__line.is-executing{display:flex;align-items:center;gap:6px;border-color:var(--pling-color-border,#cbd5e1);color:#64748b;font-size:12px}
.pling-chat__dot{width:7px;height:7px;flex:none;border-radius:50%;background:#2e9df7;animation:pling-chat-pulse 1s ease-in-out infinite}
.pling-chat__empty{margin:0;color:#94a3b8}
.pling-chat__confirm,.pling-chat__handoff{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb}
.pling-chat__confirm.is-danger{border-color:#fca5a5;background:#fef2f2}
.pling-chat__handoff{border-color:#93c5fd;background:#eff6ff}
.pling-chat__ask{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pling-chat__ask code{padding:1px 5px;border-radius:4px;background:rgb(15 23 42 / 6%);font-size:12px}
.pling-chat__desc,.pling-chat__reason{margin:0;color:#475569;font-size:12px}
.pling-chat__reason{color:#1e3a8a}
.pling-chat__steps{display:grid;gap:3px;margin:2px 0;padding:0;list-style:none}
.pling-chat__steps li{display:flex;align-items:baseline;gap:6px;color:#64748b;font-size:12px}
.pling-chat__steps li.is-current{color:#0f172a;font-weight:600}
.pling-chat__steps li.is-done{color:#15803d;text-decoration:line-through}
.pling-chat__num{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:10px;flex:none}
.pling-chat__hint{margin:0;color:#64748b;font-size:12px}
.pling-chat__resume{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:1px solid #7dd3fc;border-radius:8px;background:#f0f9ff}
.pling-chat__resume strong{color:#075985;font-size:12px}
.pling-chat__resume-hint{margin:0;color:#0369a1;font-size:12px;line-height:1.45}
.pling-chat__answers{display:flex;gap:6px;flex-wrap:wrap}
.pling-chat__answers button{padding:3px 9px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font-size:12px}
.pling-chat__answers button.is-reject{border-color:#fca5a5;color:#b91c1c}
.pling-chat__composer{display:flex;gap:6px}
.pling-chat__composer input{flex:1;min-width:0;padding:6px 8px;border:1px solid var(--pling-color-border,#cbd5e1);border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-surface,#fff);color:var(--pling-color-text,#0f172a);outline:none}
.pling-chat__composer input:focus{border-color:#2e9df7;box-shadow:0 0 0 3px rgb(46 157 247 / 15%)}
.pling-chat__composer button{padding:6px 12px;border:0;border-radius:var(--pling-radius-sm,6px);background:var(--pling-color-primary,#2e9df7);color:var(--pling-color-on-primary,#fff);cursor:pointer}
.pling-chat__composer button:disabled{opacity:.45;cursor:not-allowed}
.pling-chat__line.is-markdown p{margin:0 0 .55em}
.pling-chat__line.is-markdown p:last-child{margin-bottom:0}
.pling-chat__line.is-markdown h1,.pling-chat__line.is-markdown h2,.pling-chat__line.is-markdown h3{margin:.3em 0 .45em;line-height:1.3}
.pling-chat__line.is-markdown ul,.pling-chat__line.is-markdown ol{margin:.35em 0;padding-left:1.5em}
.pling-chat__line.is-markdown blockquote{margin:.5em 0;padding-left:.75em;border-left:3px solid #cbd5e1;color:#475569}
.pling-chat__line.is-markdown pre{overflow-x:auto;margin:.5em 0;padding:8px;border-radius:6px;background:#f1f5f9}
.pling-chat__line.is-markdown code{padding:.08em .28em;border-radius:3px;background:#eef2f7;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.94em}
.pling-chat__line.is-markdown pre code{padding:0;background:transparent;white-space:pre}
.pling-chat__line.is-markdown a{color:#0369a1;text-decoration:underline}
.pling-chat__line.is-markdown table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse}
.pling-chat__line.is-markdown th,.pling-chat__line.is-markdown td{padding:3px 6px;border:1px solid #dbe2ea;text-align:left}
@keyframes pling-dock-pulse{50%{opacity:.3}}
@keyframes pling-chat-pulse{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.pling-dock__dot,.pling-chat__dot{animation:none}}

/* Placement: the same shell works as a corner dock, a viewport sidebar, or an inline panel. */
.pling-dock--inline{position:static;display:flex;width:100%;height:100%;gap:0;align-items:stretch;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;text-align:left;z-index:auto}
.pling-dock--inline>.pling-dock__panel{width:100%;height:100%;box-shadow:none}
.pling-dock--inline>.pling-dock__launcher{display:none}
.pling-dock--sidebar{top:0;bottom:0;height:100dvh;gap:0;pointer-events:none}
.pling-dock--sidebar>.pling-dock__launcher,.pling-dock--sidebar.is-open>.pling-dock__panel{pointer-events:auto}
.pling-dock--sidebar.pling-dock--right{right:0;left:auto;align-items:flex-end}
.pling-dock--sidebar.pling-dock--left{right:auto;left:0;align-items:flex-start}
.pling-dock--sidebar>.pling-dock__panel{width:var(--pling-sidebar-width,min(420px,100vw));height:100%;border-radius:0;border-top:0;border-bottom:0;box-shadow:var(--pling-shadow-sidebar,0 0 40px rgb(15 23 42 / 18%))}
.pling-dock--sidebar.pling-dock--right>.pling-dock__panel{border-right:0}
.pling-dock--sidebar.pling-dock--left>.pling-dock__panel{border-left:0}
.pling-dock--sidebar>.pling-dock__launcher{position:absolute;top:auto;bottom:24px;padding:10px 16px;writing-mode:horizontal-tb}
.pling-dock--sidebar.pling-dock--right.pling-dock--launcher-bottom>.pling-dock__launcher{right:16px}
.pling-dock--sidebar.pling-dock--left.pling-dock--launcher-bottom>.pling-dock__launcher{left:16px}
.pling-dock--sidebar.pling-dock--launcher-center>.pling-dock__launcher{top:50%;bottom:auto;transform:translateY(-50%);padding:14px 8px;writing-mode:vertical-rl}
.pling-dock--sidebar.pling-dock--right.pling-dock--launcher-center>.pling-dock__launcher{right:0}
.pling-dock--sidebar.pling-dock--left.pling-dock--launcher-center>.pling-dock__launcher{left:0}
.pling-dock--sidebar.is-open>.pling-dock__launcher{display:none}
.pling-dock--sidebar.pling-dock--fused{position:relative;inset:auto;width:max-content;height:auto;min-height:520px;align-self:stretch;gap:12px;align-items:stretch;pointer-events:auto}
.pling-dock--sidebar.pling-dock--fused:not(.is-open){width:auto;min-height:0;align-self:flex-start}
.pling-dock--sidebar.pling-dock--fused.pling-dock--left{order:-1}
.pling-dock--sidebar.pling-dock--fused>.pling-dock__panel{width:var(--pling-sidebar-width,min(380px,100vw));height:auto;flex:1 1 auto;min-height:0;border:1px solid var(--pling-color-border,#e3e8f0);border-radius:var(--pling-radius-lg,14px);box-shadow:var(--pling-shadow-panel,0 18px 40px rgb(15 23 42 / 10%))}
.pling-dock--sidebar.pling-dock--fused>.pling-dock__launcher{position:relative;inset:auto;transform:none;padding:10px 16px;writing-mode:horizontal-tb}
.pling-dock--sidebar.pling-dock--fused.is-open>.pling-dock__launcher{display:none}
.pling-dock__run-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:2px 4px}
.pling-dock__run-label{margin:0;color:#64748b;font-size:11px;font-weight:600}
.pling-dock__run-toggle{padding:2px 7px;border:1px solid #dbe7f5;border-radius:999px;background:#fff;color:#475569;font-size:11px}
.pling-dock__run-toggle.is-active{border-color:#7dd3fc;background:#f0f9ff;color:#0369a1}
.pling-dock__model-button{cursor:pointer}
.pling-dock__model-button:hover,.pling-dock__model-button.is-active{border-color:#e3e8f0;background:#eaf6ff;color:#1677c8}
.pling-dock__model-button:focus-visible{outline:2px solid #2e9df7;outline-offset:1px}
.pling-dock__model-dot{width:5px;height:5px;flex:none;border-radius:50%;background:#22a06b}
.pling-dock__model-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pling-dock__model-caret{width:10px;height:10px;flex:none;fill:none;stroke:currentColor;stroke-width:1.4;transition:transform 120ms ease}
.pling-dock__model-button.is-active .pling-dock__model-caret{transform:rotate(180deg)}
.pling-dock__settings{flex:none}
.pling-dock__debug{flex:none;max-height:52%;overflow:auto;border-top:1px solid #f1f5f9}
.model-settings{display:flex;flex-direction:column;gap:10px;padding:6px 4px 12px;font-size:12px}
.model-settings__head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.model-settings__head h3{margin:0;font-size:13px}
.model-settings__head span,.model-settings__note{color:#64748b;font-size:11px}
.model-settings__form{display:flex;flex-direction:column;gap:9px}
.model-settings__form label{display:flex;flex-direction:column;gap:4px;color:#475569}
.model-settings__form input{width:100%;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font:inherit}
.model-settings__form input:focus{border-color:#2e9df7;outline:2px solid #eaf6ff}
.model-settings__actions{display:flex;flex-wrap:wrap;gap:8px}
.model-settings__actions button{padding:6px 10px;border-radius:999px;font:inherit;font-size:12px;cursor:pointer}
.model-settings__save{border:1px solid #2e9df7;background:#2e9df7;color:#fff}
.model-settings__reset{border:1px solid #cbd5e1;background:transparent;color:#475569}
.model-settings__note,.model-settings__error{margin:0;line-height:1.5}
.model-settings__error{color:#b91c1c}
.model-settings__facts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:7px 12px;margin:0}
.model-settings__facts dt{color:#64748b}
.model-settings__facts dd{min-width:0;margin:0;overflow-wrap:anywhere}
.debug{display:flex;flex:none;flex-direction:column;gap:4px;padding:2px 2px 8px;color:#0f172a;font-size:11px}
.debug__head{display:flex;align-items:center;gap:6px;padding:2px 0 4px}
.debug__title{font-size:12px;font-weight:600}
.debug__readonly{padding:1px 5px;border-radius:999px;background:#f8fafc;color:#94a3b8}
.debug__refresh{margin-left:auto;padding:2px 6px;border:1px solid #e3e8f0;border-radius:6px;background:#fff;color:#64748b;font:inherit;cursor:pointer}
.debug__section,.debug__call,.debug__nested{border:1px solid #f1f5f9;border-radius:7px;background:#fff}
.debug__section>summary,.debug__call>summary,.debug__nested>summary{padding:5px 7px;color:#475569;font-weight:600;cursor:pointer}
.debug__section>summary{background:#f8fafc}
.debug__section>:not(summary),.debug__call>:not(summary),.debug__nested>:not(summary){margin-right:7px;margin-left:7px}
.debug__call{margin:5px 7px}
.debug__call>summary{display:flex;flex-wrap:wrap;gap:3px 7px;font-weight:400}
.debug__status{font-weight:600}.debug__status.is-ok{color:#15803d}.debug__status.is-error{color:#b91c1c}.debug__status.is-cancelled{color:#b45309}
.debug__nested{margin-top:5px;margin-bottom:5px}
.debug__subhead{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-top:7px;color:#475569}
.debug__subhead span{color:#94a3b8;text-align:right}
.debug__list{margin:4px 0 6px;padding-left:16px}.debug__list li{margin:3px 0;line-height:1.45}.debug__list li>span{margin-left:5px}
.debug__list code,.debug__card code{color:#1677c8;word-break:break-all}.debug__desc{color:#475569}.debug__muted,.debug__note{color:#94a3b8}
.debug__card{margin-top:6px;padding:5px 7px;border-radius:6px;background:#f8fafc}.debug__card p{margin:2px 0 0;color:#64748b}
.debug__message{margin:5px 0;padding:5px 6px;border-left:2px solid #cbd5e1;background:#f8fafc}.debug__messageHead{margin:0 0 3px;color:#475569;font-family:ui-monospace,monospace}
.debug pre{box-sizing:border-box;max-height:260px;margin:3px 0 0;padding:5px 6px;overflow:auto;border-radius:5px;background:#f8fafc;color:#334155;font-family:ui-monospace,monospace;font-size:10px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
.debug__toolCalls{margin:3px 0 0;padding-left:16px;font-family:ui-monospace,monospace;font-size:10px}.debug__toolCalls li{word-break:break-all}.debug__toolCalls span{margin-left:5px;color:#475569}
.debug__severity{padding:0 4px;border-radius:4px;background:#f1f5f9}.debug__severity.is-error{background:#fee2e2;color:#b91c1c}.debug__severity.is-warning{background:#fff7ed;color:#9a3412}.debug__severity.is-success{background:#f0fdf4;color:#15803d}
.debug__error{padding:5px 6px;border-radius:6px;background:#fee2e2;color:#b91c1c;word-break:break-word}.debug__empty{color:#94a3b8;line-height:1.5}
@media (max-width:720px){.pling-dock--sidebar{top:auto;bottom:12px;height:auto;width:auto}.pling-dock--sidebar.pling-dock--right{right:12px;left:auto}.pling-dock--sidebar.pling-dock--left{right:auto;left:12px}.pling-dock--sidebar>.pling-dock__panel{width:min(400px,calc(100vw - 24px));height:min(640px,calc(100dvh - 72px));border:1px solid #e3e8f0;border-radius:12px}.pling-dock--sidebar>.pling-dock__launcher{position:relative;inset:auto;transform:none;padding:10px 16px;writing-mode:horizontal-tb}.pling-dock--sidebar.pling-dock--fused{position:fixed;right:12px;bottom:12px;left:auto;width:auto;min-height:0}.pling-dock--sidebar.pling-dock--fused>.pling-dock__panel{width:min(400px,calc(100vw - 24px));height:min(640px,calc(100dvh - 72px))}}

/* Shared @plingjs/ui tokens. Kept as one override layer so the structural CSS
   above stays readable while every visible colour still belongs to the theme. */
.pling-dock{color:var(--pling-color-text,#0f172a);font-family:var(--pling-font-family,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif)}
.pling-dock__panel{border-color:var(--pling-color-border,#dbe7f5);background:var(--pling-color-surface,#fff);border-radius:var(--pling-radius-lg,14px);box-shadow:var(--pling-shadow-panel,0 18px 48px rgb(15 23 42 / 18%))}
.pling-dock__warn{border-color:var(--pling-color-warning,#fdba74);background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-dock__quick button{border-color:var(--pling-color-border,#cbd5e1);background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#334155)}
.pling-dock__model{background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#64748b)}
.pling-dock__gate{color:var(--pling-color-warning,#b45309)}
.pling-dock__ghost{color:var(--pling-color-text-muted,#64748b)}
.pling-dock__tabs{border-bottom-color:var(--pling-color-border-muted,#e2e8f0)}
.pling-dock__tabs button{color:var(--pling-color-text-muted,#64748b)}
.pling-dock__tabs button.is-active{border-bottom-color:var(--pling-color-primary,#2e9df7);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__badge{background:var(--pling-color-primary-soft,#eff6ff);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__badge.is-bad{background:var(--pling-color-danger-soft,#fee2e2);color:var(--pling-color-danger,#b91c1c)}
.pling-dock__role{border-color:var(--pling-color-border,#dbe7f5);background:var(--pling-color-surface-muted,#f8fbff);color:var(--pling-color-text-muted,#475569)}
.pling-dock__role.is-readonly{border-color:var(--pling-color-primary,#bae6fd);background:var(--pling-color-primary-soft,#f0f9ff);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__role.is-lost{border-color:var(--pling-color-warning,#fdba74);background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-dock__row{border-bottom-color:var(--pling-color-border-muted,#f1f5f9)}
.pling-dock__activity code{color:var(--pling-color-text,#0f172a)}
.pling-dock__state{color:var(--pling-color-text-muted,#64748b)}
.pling-dock__state.is-running{color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__state.is-ok{color:var(--pling-color-success,#15803d)}
.pling-dock__state.is-failed,.pling-dock__state.is-blocked{color:var(--pling-color-danger,#b91c1c)}
.pling-dock__desc,.pling-dock__tasks-intro{color:var(--pling-color-text-muted,#64748b)}
.pling-dock__args{background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-muted,#334155);font-family:var(--pling-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.pling-dock__detail,.pling-dock__activity .pling-dock__empty,.pling-dock__meta,.pling-dock__usage{color:var(--pling-color-text-subtle,#94a3b8)}
.pling-dock__task{border-color:var(--pling-color-border,#e2e8f0);background:var(--pling-color-surface,#fff)}
.pling-dock__task.is-current{border-color:var(--pling-color-primary,#7dd3fc);background:var(--pling-color-primary-soft,#f8fbff)}
.pling-dock__tag{background:var(--pling-color-surface-muted,#f1f5f9);color:var(--pling-color-text-muted,#64748b)}
.pling-dock__tag.is-owner{background:var(--pling-color-success-soft,#dcfce7);color:var(--pling-color-success,#15803d)}
.pling-dock__tag.is-remote{background:var(--pling-color-warning-soft,#fef3c7);color:var(--pling-color-warning,#b45309)}
.pling-dock__task-actions button{border-color:var(--pling-color-primary,#bae6fd);background:var(--pling-color-primary-soft,#f0f9ff);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__task-error{background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-dock__task-empty{background:var(--pling-color-surface-muted,#f8fafc);color:var(--pling-color-text-subtle,#94a3b8)}
.pling-dock__launcher{background:var(--pling-color-primary,#2e9df7);color:var(--pling-color-on-primary,#fff);box-shadow:var(--pling-shadow-launcher,0 10px 24px rgb(46 157 247 / 32%))}
.pling-dock__launcher.is-open{background:var(--pling-color-text-muted,#475569);box-shadow:none}
.pling-dock__dot,.pling-chat__dot{background:var(--pling-color-primary,#2e9df7)}
.pling-chat{color:var(--pling-color-text,#0f172a);font-family:var(--pling-font-family,ui-sans-serif,system-ui,sans-serif)}
.pling-chat__head,.pling-chat__composer{border-color:var(--pling-color-border-muted,#eef2f7)}
.pling-chat__running{color:var(--pling-color-primary-strong,#0369a1)}
.pling-chat__stop{border-color:var(--pling-color-border,#cbd5e1);background:var(--pling-color-surface,#fff);color:var(--pling-color-text-muted,#475569)}
.pling-chat__line{border-left-color:var(--pling-color-border,#dbe7f5)}
.pling-chat__line.is-user{border-left-color:var(--pling-color-primary,#7dd3fc);background:var(--pling-color-primary-soft,#f0f9ff)}
.pling-chat__line.is-assistant{border-left-color:var(--pling-color-border,#ddd)}
.pling-chat__line.is-final{border-left-color:var(--pling-color-success,#86efac);background:var(--pling-color-success-soft,#f0fdf4)}
.pling-chat__line.is-notice,.pling-chat__confirm,.pling-chat__handoff{border-color:var(--pling-color-warning,#fde68a);background:var(--pling-color-warning-soft,#fffbeb);color:var(--pling-color-warning,#92400e)}
.pling-chat__line.is-error,.pling-chat__confirm.is-danger{border-color:var(--pling-color-danger,#fca5a5);background:var(--pling-color-danger-soft,#fef2f2);color:var(--pling-color-danger,#b91c1c)}
.pling-chat__line.is-blocked{border-color:var(--pling-color-warning,#fdba74);background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-chat__line.is-call,.pling-chat__line.is-result,.pling-chat__line.is-markdown code{font-family:var(--pling-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.pling-chat__line.is-result{border-color:var(--pling-color-danger,#fca5a5);color:var(--pling-color-danger,#b91c1c)}
.pling-chat__line.is-result.is-ok{border-color:var(--pling-color-success,#86efac);color:var(--pling-color-success,#15803d)}
.pling-chat__line.is-executing,.pling-chat__desc,.pling-chat__reason,.pling-chat__steps li,.pling-chat__hint{color:var(--pling-color-text-muted,#64748b)}
.pling-chat__dot{background:var(--pling-color-primary,#2e9df7)}
.pling-chat__args,.pling-chat__empty{color:var(--pling-color-text-subtle,#94a3b8)}
.pling-chat__num{background:var(--pling-color-primary-soft,#dbeafe);color:var(--pling-color-primary-strong,#1d4ed8)}
.pling-chat__resume{border-color:var(--pling-color-primary,#7dd3fc);background:var(--pling-color-primary-soft,#f0f9ff)}
.pling-chat__resume strong,.pling-chat__resume-hint{color:var(--pling-color-primary-strong,#075985)}
.pling-chat__answers button{border-color:var(--pling-color-border,#cbd5e1);background:var(--pling-color-surface,#fff);color:var(--pling-color-text-muted,#334155)}
.pling-chat__answers button.is-reject{border-color:var(--pling-color-danger,#fca5a5);color:var(--pling-color-danger,#b91c1c)}
.pling-chat__composer input{border-color:var(--pling-color-border,#cbd5e1);background:var(--pling-color-surface,#fff);color:var(--pling-color-text,#0f172a)}
.pling-chat__composer input:focus{border-color:var(--pling-color-primary,#2e9df7)}
.pling-chat__composer button{background:var(--pling-color-primary,#2e9df7);color:var(--pling-color-on-primary,#fff)}
.pling-chat__line.is-markdown blockquote{border-left-color:var(--pling-color-border,#cbd5e1);color:var(--pling-color-text-muted,#475569)}
.pling-chat__line.is-markdown pre,.pling-chat__line.is-markdown code{background:var(--pling-color-surface-muted,#f1f5f9)}
.pling-chat__line.is-markdown a{color:var(--pling-color-primary-strong,#0369a1)}
.pling-chat__line.is-markdown th,.pling-chat__line.is-markdown td{border-color:var(--pling-color-border,#dbe2ea)}
`;
