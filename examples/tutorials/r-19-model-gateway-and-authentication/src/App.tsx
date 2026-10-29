import { useState } from "react";
import {
  AgentDock,
  useAgentTool,
  usePlingRecord,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import { browserAgentConfig } from "./agent-config";
import type { DemoLocale } from "./locale";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const COPY = {
  en: {
    eyebrow: "Model gateway",
    heading: "Tasks without a browser-side model key",
    lead: "The page calls its own origin. The gateway adds the provider credential and records the request.",
    open: (count: number) => `${count} open`,
    add: "Add",
    placeholder: "New task",
    browserConfig: "Browser configuration",
    model: "Model",
    apiKey: "API key: none in the browser",
    signInPrompt: "Sign in to use the hosted model gateway.",
    signingIn: "Signing in…",
    signedIn: "Signed in. Model requests stay on the same origin.",
    signInFailed: "Sign-in failed.",
    signedOut: "Signed out.",
    demoPassword: "Demo password",
    signIn: "Sign in",
    signOut: "Sign out",
    assistant: "Todo assistant · gateway",
    quick: ["Add a task to call the design lead", "What is open?"],
    regionDescription: "Tasks and the gateway session status.",
    taskList: "Tasks",
    addDesc: "Add a task to the list.",
    taskText: "Task text",
    draftDesc: "Enter the text of a new task.",
    toggleDesc: (text: string, next: string) => `Mark “${text}” as ${next}.`,
    sessionDesc: "Read whether the browser has an authenticated gateway session.",
    done: "done",
    openState: "open",
  },
  zh: {
    eyebrow: "模型网关",
    heading: "浏览器里没有模型密钥的任务列表",
    lead: "页面只请求自己的源站。网关补上供应商凭据，并记录这次请求。",
    open: (count: number) => `${count} 项未完成`,
    add: "添加",
    placeholder: "新任务",
    browserConfig: "浏览器配置",
    model: "模型",
    apiKey: "API 密钥：浏览器中没有",
    signInPrompt: "请先登录，再使用托管的模型网关。",
    signingIn: "正在登录…",
    signedIn: "已登录。模型请求保持在同源。",
    signInFailed: "登录失败。",
    signedOut: "已退出登录。",
    demoPassword: "演示密码",
    signIn: "登录",
    signOut: "退出",
    assistant: "任务助手 · 网关",
    quick: ["新增一条“联系设计负责人”的任务", "现在还有哪些任务没完成？"],
    regionDescription: "任务列表与网关会话状态。",
    taskList: "任务",
    addDesc: "向列表新增一条任务。",
    taskText: "任务内容",
    draftDesc: "输入新任务的内容。",
    toggleDesc: (text: string, next: string) => `把“${text}”标记为${next === "done" ? "已完成" : "未完成"}。`,
    sessionDesc: "读取浏览器是否已有通过鉴权的网关会话。",
    done: "已完成",
    openState: "未完成",
  },
} as const;

const INITIAL_TASKS: Task[] = [
  { id: "t1", text: "Review the release checklist", done: false },
  { id: "t2", text: "Send the customer follow-up", done: true },
  { id: "t3", text: "Book the design review", done: false },
];

function TaskRow({
  task,
  copy,
  onToggle,
}: {
  task: Task;
  copy: (typeof COPY)[DemoLocale];
  onToggle: (id: string) => void;
}) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    id: task.id,
    fields: { text: task.text, status: task.done ? "done" : "open" },
  });
  const toggleRef = usePlingTool<HTMLInputElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done ? "open" : "done"),
    kind: "write",
    run: () => onToggle(task.id),
  });
  return (
    <li ref={rowRef} className={task.done ? "done" : undefined}>
      <label>
        <input
          ref={toggleRef}
          type="checkbox"
          checked={task.done}
          onChange={() => onToggle(task.id)}
        />
        <span>{task.text}</span>
      </label>
    </li>
  );
}

export function App({ locale }: { locale: DemoLocale }) {
  const copy = COPY[locale];
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [draft, setDraft] = useState("");
  const [password, setPassword] = useState("");
  const [sessionMessage, setSessionMessage] = useState<string>(copy.signInPrompt);
  const [signedIn, setSignedIn] = useState(false);

  function addTask(text: string): void {
    const value = text.trim();
    if (!value) return;
    setTasks((current) => [
      { id: `t${Date.now().toString(36)}`, text: value, done: false },
      ...current,
    ]);
  }

  function submitDraft(): void {
    if (!draft.trim()) return;
    addTask(draft);
    setDraft("");
  }

  function toggleTask(id: string): void {
    setTasks((current) => current.map((task) => (
      task.id === id ? { ...task, done: !task.done } : task
    )));
  }

  const scopeRef = usePlingScope<HTMLElement>({
    id: "todo",
    label: locale === "zh" ? "任务列表" : "Todo list",
    description: copy.regionDescription,
    role: "main",
  });
  const listRef = usePlingScope<HTMLUListElement>({
    id: "task_list",
    label: copy.taskList,
    role: "list",
  });
  const draftRef = usePlingTool<HTMLInputElement>({
    id: "draft_input",
    action: "fill",
    desc: copy.draftDesc,
  });
  const addRef = usePlingTool<HTMLButtonElement>({
    id: "add_task",
    desc: copy.addDesc,
    kind: "write",
    params: [{ name: "text", label: copy.taskText, minLength: 1, maxLength: 80 }],
    run: (args: Record<string, unknown>) => addTask(String(args.text ?? "")),
  });
  useAgentTool({
    id: "sign_in_status",
    desc: copy.sessionDesc,
    kind: "read",
    run: () => ({ signedIn, gateway: browserAgentConfig.baseUrl }),
  });

  async function signIn(): Promise<void> {
    setSessionMessage(copy.signingIn);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSignedIn(response.ok);
    setSessionMessage(response.ok ? copy.signedIn : copy.signInFailed);
  }

  async function signOut(): Promise<void> {
    await fetch("/api/session/logout", { method: "POST" });
    setSignedIn(false);
    setSessionMessage(copy.signedOut);
  }

  const openCount = tasks.filter((task) => !task.done).length;

  return (
    <main className="page">
      <section className="todo" ref={scopeRef}>
        <header className="todo__head">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.heading}</h1>
            <p className="lead">{copy.lead}</p>
          </div>
          <span className="counter">{copy.open(openCount)}</span>
        </header>

        <form className="composer" onSubmit={(event) => { event.preventDefault(); submitDraft(); }}>
          <input
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
          />
          <button ref={addRef} type="submit">{copy.add}</button>
        </form>

        <ul className="tasks" ref={listRef}>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} copy={copy} onToggle={toggleTask} />
          ))}
        </ul>

        <aside className="gateway" data-pling-ignore>
          <div>
            <strong>{copy.browserConfig}</strong>
            <code>{browserAgentConfig.baseUrl}</code>
            <span>{copy.model}: {browserAgentConfig.model}</span>
            <span>{copy.apiKey}</span>
          </div>
          <div className="gateway__session">
            <p>{sessionMessage}</p>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder={copy.demoPassword}
              aria-label={copy.demoPassword}
            />
            <div>
              <button type="button" onClick={() => void signIn()}>{copy.signIn}</button>
              <button type="button" className="secondary" onClick={() => void signOut()}>{copy.signOut}</button>
            </div>
          </div>
        </aside>
      </section>

      <AgentDock
        title={copy.assistant}
        quick={[...copy.quick]}
        debug={{ maxCalls: 8 }}
      />
    </main>
  );
}
