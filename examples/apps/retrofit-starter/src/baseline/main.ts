import { createApp } from "vue";
import App from "./App.vue";
import { resolveLocale } from "../shared/copy";
import "../shared/app.css";

createApp(App, { locale: resolveLocale() }).mount("#app");
