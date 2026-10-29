<script setup lang="ts">
import { computed, ref } from "vue";
import { AgentDock, useAgentTool, type ToolOptions } from "@plingjs/vue";
import { browserAgentConfig } from "./agent-config";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const tasks = ref<Task[]>([
  { id: "t1", text: "Review the release checklist", done: false },
  { id: "t2", text: "Send the customer follow-up", done: true },
  { id: "t3", text: "Book the design review", done: false },
]);
const draft = ref("");
const password = ref("");
const sessionMessage = ref("Sign in to use the hosted model gateway.");
let sequence = 3;

const status = computed(() => `${tasks.value.filter((task) => !task.done).length} open`);

function addTask(text: string): void {
  const value = text.trim();
  if (!value) return;
  tasks.value.unshift({ id: `t${++sequence}`, text: value, done: false });
}

function submitDraft(): void {
  if (!draft.value.trim()) return;
  addTask(draft.value);
  draft.value = "";
}

function toggleTask(task: Task): void {
  task.done = !task.done;
}

const addTaskAction: ToolOptions = {
  id: "add_task",
  desc: "Add a task to the list.",
  kind: "write",
  params: [{ name: "text", label: "Task text", minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => addTask(String(text)),
};

useAgentTool({
  id: "sign_in_status",
  desc: "Read whether the browser has an authenticated gateway session.",
  kind: "read",
  run: () => ({ signedIn: sessionMessage.value.startsWith("Signed in"), gateway: browserAgentConfig.baseUrl }),
});

async function signIn(): Promise<void> {
  sessionMessage.value = "Signing in…";
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: password.value }),
  });
  sessionMessage.value = response.ok ? "Signed in. Model requests stay on the same origin." : "Sign-in failed.";
}

async function signOut(): Promise<void> {
  await fetch("/api/session/logout", { method: "POST" });
  sessionMessage.value = "Signed out.";
}
</script>

<template>
  <main class="page">
    <section
      class="todo"
      v-scope="{ id: 'todo', label: 'Todo list', description: 'Tasks and the gateway session status.', role: 'main' }"
    >
      <header class="todo__head">
        <div>
          <p class="eyebrow">Model gateway</p>
          <h1>Tasks without a browser-side model key</h1>
          <p class="lead">The page calls its own origin. The gateway adds the provider credential and records the request.</p>
        </div>
        <span class="counter">{{ status }}</span>
      </header>

      <form class="composer" @submit.prevent="submitDraft">
        <input
          v-model="draft"
          v-tool="{ id: 'draft_input', action: 'fill', desc: 'Enter the text of a new task.' }"
          placeholder="New task"
          aria-label="New task"
        />
        <button type="submit" v-tool="addTaskAction">Add</button>
      </form>

      <ul class="tasks" v-scope="{ id: 'task_list', label: 'Tasks', role: 'list' }">
        <li
          v-for="task in tasks"
          :key="task.id"
          :class="{ done: task.done }"
          v-record="{
            data: task,
            fields: { text: task.text, status: task.done ? 'done' : 'open' },
          }"
        >
          <label>
            <input
              type="checkbox"
              :checked="task.done"
              v-tool="{
                id: `toggle@${task.id}`,
                desc: `Mark “${task.text}” as ${task.done ? 'open' : 'done'}.`,
                kind: 'write',
              }"
              @change="toggleTask(task)"
            />
            <span>{{ task.text }}</span>
          </label>
        </li>
      </ul>

      <aside class="gateway" data-pling-ignore>
        <div>
          <strong>Browser configuration</strong>
          <code>{{ browserAgentConfig.baseUrl }}</code>
          <span>Model: {{ browserAgentConfig.model }}</span>
          <span>API key: none in the browser</span>
        </div>
        <div class="gateway__session">
          <p>{{ sessionMessage }}</p>
          <input v-model="password" type="password" placeholder="Demo password" aria-label="Demo password" />
          <div>
            <button type="button" @click="signIn">Sign in</button>
            <button type="button" class="secondary" @click="signOut">Sign out</button>
          </div>
        </div>
      </aside>
    </section>

    <AgentDock
      title="Todo assistant · gateway"
      :quick="['Add a task to call the design lead', 'What is open?']"
      :debug="{ maxCalls: 8 }"
    />
  </main>
</template>
