import { createApp } from "vue";
import "@wikimedia/codex-design-tokens/theme-wikimedia-ui.css";
import "@wikimedia/codex/dist/codex.style.css";
import App from "./App.vue";
import { router } from "./router/index";
import { i18n } from "./i18n/index";

const app = createApp(App);
app.use(router);
app.use(i18n);
app.mount("#app");
