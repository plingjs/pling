import { createListPage } from "../src/ListPage";
import { agentSetup } from "./setup";
import "../src/styles.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("缺少 #root 挂载点");

createListPage(root, { agent: agentSetup });
