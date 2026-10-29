<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, ApiError, type Todo, type User } from "../src/api";
import AuthPanel from "../src/components/AuthPanel.vue";
import TodoWorkspace from "../src/components/TodoWorkspace.vue";

const loading = ref(true);
const startupError = ref("");
const user = ref<User | null>(null);
const todos = ref<Todo[]>([]);

onMounted(async () => {
  try {
    const session = await api.session();
    user.value = session.user;
    todos.value = session.todos;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) startupError.value = messageOf(error);
  } finally {
    loading.value = false;
  }
});

function authenticated(value: { user: User; todos: Todo[] }): void {
  user.value = value.user;
  todos.value = value.todos;
  startupError.value = "";
}

async function signOut(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // The local session is cleared even if the demo server has already restarted.
  } finally {
    user.value = null;
    todos.value = [];
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Pling Surface demo home">
        <span class="brand__mark" aria-hidden="true">π</span>
        <span>
          <strong>Pling</strong>
          <small>Surface demo</small>
        </span>
      </a>
      <div v-if="user" class="account">
        <span class="account__identity">{{ user.name }} <small>{{ user.email }}</small></span>
        <button type="button" @click="signOut">Sign out</button>
      </div>
      <span v-else class="topbar__note">Demo · in-memory data</span>
    </header>

    <main>
      <section v-if="loading" class="status-card" aria-live="polite">Checking your session…</section>
      <section v-else-if="startupError" class="status-card status-card--error" role="alert">
        <h1>The demo server is not reachable.</h1>
        <p>{{ startupError }}</p>
        <p>Start the local demo from the project workspace and reload this page.</p>
      </section>
      <AuthPanel v-else-if="!user" @authenticated="authenticated" />
      <template v-else>
        <section class="hero" aria-labelledby="hero-title">
          <div>
            <p class="eyebrow">Authenticated Todo · BFF session · Surface gateway</p>
            <h1 id="hero-title">One page. Two agents. One permission boundary.</h1>
            <p>
              The in-page assistant uses the business page directly. A paired external Agent sees only the capabilities
              this page exposes, and destructive requests return here for a person to approve.
            </p>
          </div>
          <ul class="flow" aria-label="Agent access flow">
            <li><span>1</span>Sign in</li>
            <li><span>2</span>Enable Surface</li>
            <li><span>3</span>Pair an Agent</li>
            <li><span>4</span>Agents operate</li>
          </ul>
        </section>
        <TodoWorkspace :user="user" :initial-todos="todos" />
      </template>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 60px;
  padding: 0 24px;
  border-bottom: 1px solid rgb(219 230 242 / 80%);
  background: rgb(243 247 252 / 88%);
  backdrop-filter: blur(12px);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #0f172a;
  text-decoration: none;
}
.brand__mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: #2e9df7;
  color: #fff;
  font-size: 17px;
  font-weight: 750;
}
.brand > span:last-child {
  display: grid;
  gap: 1px;
}
.brand strong {
  font-size: 13px;
  letter-spacing: 0.01em;
}
.brand small {
  color: #64748b;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.account {
  display: flex;
  align-items: center;
  gap: 11px;
}
.account__identity {
  display: grid;
  gap: 1px;
  color: #334155;
  font-size: 11px;
  font-weight: 650;
  text-align: right;
}
.account__identity small {
  color: #94a3b8;
  font-weight: 400;
}
.account button {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.topbar__note {
  color: #94a3b8;
  font-size: 10px;
}
.status-card {
  width: min(640px, calc(100vw - 40px));
  margin: 14vh auto;
  padding: 26px;
  border: 1px solid #dbe6f2;
  border-radius: 16px;
  background: #fff;
  color: #475569;
  text-align: center;
}
.status-card h1 {
  margin: 0 0 8px;
  color: #0f172a;
  font-size: 22px;
}
.status-card p {
  margin: 6px 0;
  font-size: 12px;
  line-height: 1.6;
}
.status-card code {
  padding: 2px 5px;
  border-radius: 4px;
  background: #eef2f7;
  font-size: 10px;
}
.status-card--error {
  border-color: #fecaca;
  background: #fff7f7;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 28px;
  align-items: end;
  width: min(1120px, calc(100vw - 40px));
  margin: 0 auto;
  padding: 46px 0 26px;
}
.eyebrow {
  margin: 0 0 8px;
  color: #1677c8;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.hero h1 {
  max-width: 760px;
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 5vw, 58px);
  letter-spacing: -0.05em;
  line-height: 1.02;
}
.hero p:not(.eyebrow) {
  max-width: 760px;
  margin: 15px 0 0;
  color: #52637a;
  font-size: 13px;
  line-height: 1.7;
}
.flow {
  display: grid;
  gap: 7px;
  min-width: 210px;
  margin: 0;
  padding: 14px;
  border: 1px solid #dbe6f2;
  border-radius: 13px;
  background: rgb(255 255 255 / 72%);
  list-style: none;
}
.flow li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 10px;
  font-weight: 600;
}
.flow span {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #eaf6ff;
  color: #1677c8;
  font-size: 9px;
  font-weight: 800;
}
@media (max-width: 850px) {
  .hero {
    grid-template-columns: 1fr;
    padding-top: 30px;
  }
  .flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .topbar {
    padding: 0 14px;
  }
  .account__identity {
    display: none;
  }
  .hero {
    width: calc(100vw - 24px);
  }
  .flow {
    grid-template-columns: 1fr;
  }
}
</style>
