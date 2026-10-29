import { mountQuickstart } from "./app";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

mountQuickstart(root);
