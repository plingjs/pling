import type { RouteRecordRaw } from "vue-router";
import AccountDetail from "./pages/AccountDetail.vue";
import AccountList from "./pages/AccountList.vue";
import ActivityPage from "./pages/ActivityPage.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/accounts" },
  {
    path: "/accounts",
    name: "accounts",
    component: AccountList,
    meta: { title: "Accounts" },
  },
  {
    path: "/accounts/:id",
    name: "account-detail",
    component: AccountDetail,
    meta: { title: "Account detail" },
  },
  {
    path: "/activity",
    name: "activity",
    component: ActivityPage,
    meta: { title: "Activity" },
  },
];
