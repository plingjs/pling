import { mountSetup } from "./app";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

mountSetup(root);
