<script setup lang="ts">
import { computed, ref } from "vue";
import { api, ApiError, type Todo, type User } from "../api";

const emit = defineEmits<{ authenticated: [value: { user: User; todos: Todo[] } ] }>();

const mode = ref<"login" | "register">("login");
const name = ref("");
const email = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");

const title = computed(() => (mode.value === "login" ? "Sign in to your workspace" : "Create a demo account"));
const action = computed(() => (mode.value === "login" ? "Sign in" : "Create account"));

function switchMode(next: "login" | "register"): void {
  mode.value = next;
  error.value = "";
}

async function submit(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result =
      mode.value === "login"
        ? await api.login({ email: email.value, password: password.value })
        : await api.register({
            email: email.value,
            password: password.value,
            ...(name.value.trim() ? { name: name.value } : {}),
          });
    emit("authenticated", { user: result.user, todos: result.todos });
  } catch (failure) {
    error.value = failure instanceof ApiError ? failure.message : failure instanceof Error ? failure.message : String(failure);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="auth-card" aria-labelledby="auth-title">
    <div class="auth-card__intro">
      <p class="eyebrow">Pling · authenticated Surface demo</p>
      <h1 id="auth-title">A business page with two kinds of agents.</h1>
      <p>
        Use the assistant inside the page, or pair an external Agent such as Codex, Claude, or Hermes. Both act on
        the same declared capabilities. The page keeps its own login, data, and approval boundary.
      </p>
      <dl>
        <div>
          <dt>Page agent</dt>
          <dd>Runs inside the application with the configured model.</dd>
        </div>
        <div>
          <dt>External agent</dt>
          <dd>Connects through a short-lived Surface session and a one-time pairing code.</dd>
        </div>
        <div>
          <dt>Human approval</dt>
          <dd>Destructive actions wait for a person in the open business page.</dd>
        </div>
      </dl>
    </div>

    <form class="auth-form" @submit.prevent="submit">
      <div class="auth-form__tabs" role="tablist" aria-label="Account action">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'login'"
          :class="{ active: mode === 'login' }"
          @click="switchMode('login')"
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'register'"
          :class="{ active: mode === 'register' }"
          @click="switchMode('register')"
        >
          Register
        </button>
      </div>

      <div class="auth-form__heading">
        <p class="eyebrow">Demo account</p>
        <h2>{{ title }}</h2>
        <p>Data is stored in memory and disappears when the demo server restarts.</p>
      </div>

      <label v-if="mode === 'register'">
        <span>Name <small>(optional)</small></span>
        <input v-model="name" name="name" autocomplete="name" maxlength="80" placeholder="Ada Lovelace" />
      </label>
      <label>
        <span>Email</span>
        <input
          v-model="email"
          name="email"
          type="email"
          autocomplete="email"
          required
          maxlength="254"
          placeholder="you@example.com"
        />
      </label>
      <label>
        <span>Password</span>
        <input
          v-model="password"
          name="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          required
          minlength="8"
          maxlength="200"
          placeholder="At least 8 characters"
        />
      </label>

      <p v-if="error" class="auth-form__error" role="alert">{{ error }}</p>
      <button class="auth-form__submit" type="submit" :disabled="busy">
        {{ busy ? "Working…" : action }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.auth-card {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 28px;
  width: min(1040px, calc(100vw - 40px));
  margin: 8vh auto;
}
.auth-card__intro,
.auth-form {
  border: 1px solid #dbe6f2;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 22px 60px rgb(15 23 42 / 8%);
}
.auth-card__intro {
  padding: clamp(28px, 5vw, 52px);
  background:
    radial-gradient(circle at 94% 4%, rgb(46 157 247 / 14%), transparent 34%),
    #fff;
}
.eyebrow {
  margin: 0 0 8px;
  color: #1677c8;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
h1 {
  max-width: 620px;
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 5vw, 58px);
  letter-spacing: -0.045em;
  line-height: 1.04;
}
.auth-card__intro > p:not(.eyebrow) {
  max-width: 620px;
  margin: 20px 0 30px;
  color: #475569;
  line-height: 1.7;
}
dl {
  display: grid;
  gap: 16px;
  margin: 0;
}
dl > div {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 18px;
  padding-top: 16px;
  border-top: 1px solid #e8eef5;
}
dt {
  color: #0f172a;
  font-weight: 700;
}
dd {
  margin: 0;
  color: #64748b;
  line-height: 1.55;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
}
.auth-form__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 11px;
  background: #f1f5f9;
}
.auth-form__tabs button {
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.auth-form__tabs button.active {
  background: #fff;
  color: #0f172a;
  box-shadow: 0 2px 8px rgb(15 23 42 / 8%);
}
.auth-form__heading h2 {
  margin: 0;
  font-size: 23px;
  letter-spacing: -0.025em;
}
.auth-form__heading > p:last-child {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
label {
  display: grid;
  gap: 6px;
  color: #334155;
  font-size: 12px;
  font-weight: 650;
}
label small {
  color: #94a3b8;
  font-weight: 400;
}
input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  color: #0f172a;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
}
input:focus {
  border-color: #2e9df7;
  outline: 3px solid rgb(46 157 247 / 15%);
}
.auth-form__error {
  margin: 0;
  padding: 9px 11px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}
.auth-form__submit {
  margin-top: 2px;
  padding: 11px 16px;
  border: 0;
  border-radius: 10px;
  background: #2e9df7;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.auth-form__submit:disabled {
  background: #94a3b8;
  cursor: wait;
}
@media (max-width: 760px) {
  .auth-card {
    grid-template-columns: 1fr;
    margin: 24px auto;
  }
  dl > div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
