/** 原生问答入口的样式；类名与 Vue / React 浮窗保持一致。 */
export const DOCK_STYLES = `
.pling-dock{position:fixed;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;text-align:left}
.pling-dock *{box-sizing:border-box}
.pling-dock [hidden]{display:none!important}
.pling-dock button,.pling-dock input{font:inherit}
.pling-dock button{cursor:pointer}
.pling-dock__panel{display:flex;flex-direction:column;gap:6px;width:min(400px,calc(100vw - 48px));height:min(600px,calc(100vh - 120px));padding:12px;border:1px solid #dbe7f5;border-radius:14px;background:#fff;box-shadow:0 18px 48px rgb(15 23 42 / 18%)}
.pling-dock__warn{margin:0;padding:8px 10px;border:1px solid #fdba74;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12px}
.pling-dock__quick{display:flex;flex-wrap:wrap;gap:6px}
.pling-dock__quick button{padding:3px 8px;border:1px solid #bae6fd;border-radius:999px;background:#f0f9ff;color:#0369a1;font-size:12px}
.pling-dock__quick button:disabled{opacity:.5;cursor:not-allowed}
.pling-dock__bar{display:flex;align-items:center;gap:6px;min-height:22px}
.pling-dock__model{max-width:150px;overflow:hidden;padding:1px 6px;border-radius:999px;background:#eff6ff;color:#0369a1;font-size:11px;white-space:nowrap;text-overflow:ellipsis}
.pling-dock__gate{color:#b45309;font-size:11px;white-space:nowrap}
.pling-dock__ghost{padding:2px 4px;border:0;background:none;color:#64748b;font-size:12px}
.pling-dock__ghost:last-child{margin-left:auto}
.pling-dock__tabs{display:flex;gap:4px;margin:2px 0 6px;border-bottom:1px solid #e2e8f0}
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
.pling-dock__activity-view{flex-direction:column}
.pling-dock__activity{flex:1;min-height:0;overflow:auto;margin:0;padding:4px 4px 4px 22px;font-size:12px}
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
.pling-dock__dot{position:absolute;top:6px;right:8px;width:7px;height:7px;border-radius:50%;background:#fbbf24;animation:pling-dock-pulse 1s ease-in-out infinite}
.pling-chat{display:flex;flex-direction:column;gap:8px;flex:1;height:100%;min-height:0;color:#0f172a;font-size:13px;line-height:1.5;text-align:left}
.pling-chat__head{display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid #eef2f7}
.pling-chat__running{color:#0369a1;font-size:12px}
.pling-chat__stop{margin-left:auto;padding:2px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569}
.pling-chat__transcript{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px}
.pling-chat__pending{display:contents}
.pling-chat__line{margin:0;padding:6px 8px;border-left:3px solid #dbe7f5;border-radius:6px;white-space:pre-wrap;word-break:break-word}
.pling-chat__line.is-user{border-color:#7dd3fc;background:#f0f9ff}
.pling-chat__line.is-assistant{border-color:#c7d2fe}
.pling-chat__line.is-final{border-color:#86efac;background:#f0fdf4}
.pling-chat__line.is-markdown{white-space:normal}
.pling-chat__line.is-notice{border-color:#fde68a;background:#fffbeb;color:#92400e;font-size:12px}
.pling-chat__line.is-error{border-color:#fca5a5;background:#fef2f2;color:#b91c1c}
.pling-chat__line.is-blocked{border-color:#fdba74;background:#fff7ed;color:#9a3412}
.pling-chat__line.is-executing{display:flex;align-items:center;gap:6px;border-color:#bae6fd;color:#64748b;font-size:12px}
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
.pling-chat__composer{display:flex;gap:6px;padding-top:6px;border-top:1px solid #eef2f7}
.pling-chat__composer input{flex:1;min-width:0;padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#0f172a;outline:none}
.pling-chat__composer input:focus{border-color:#2e9df7;box-shadow:0 0 0 3px rgb(46 157 247 / 15%)}
.pling-chat__composer button{padding:6px 12px;border:0;border-radius:7px;background:#2e9df7;color:#fff}
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

/* Shared @plingjs/ui tokens. Kept as one override layer so the structural CSS
   above stays readable while every visible colour still belongs to the theme. */
.pling-dock{color:var(--pling-color-text,#0f172a);font-family:var(--pling-font-family,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif)}
.pling-dock__panel{border-color:var(--pling-color-border,#dbe7f5);background:var(--pling-color-surface,#fff);border-radius:var(--pling-radius-lg,14px);box-shadow:var(--pling-shadow-panel,0 18px 48px rgb(15 23 42 / 18%))}
.pling-dock__warn{border-color:var(--pling-color-warning,#fdba74);background:var(--pling-color-warning-soft,#fff7ed);color:var(--pling-color-warning,#9a3412)}
.pling-dock__quick button{border-color:var(--pling-color-primary,#bae6fd);background:var(--pling-color-primary-soft,#f0f9ff);color:var(--pling-color-primary-strong,#0369a1)}
.pling-dock__model{background:var(--pling-color-primary-soft,#eff6ff);color:var(--pling-color-primary-strong,#0369a1)}
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
.pling-chat__line.is-assistant{border-left-color:var(--pling-color-primary,#c7d2fe)}
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
