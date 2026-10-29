export type Locale = "en" | "zh";
export type Plan = "starter" | "pro";
export type OrderStatus = "open" | "paid";

export interface Order {
  id: string;
  customer: string;
  email: string;
  amount: number;
  plan: Plan;
  status: OrderStatus;
}

export interface Copy {
  title: string;
  subtitle: string;
  switchLanguage: string;
  formTitle: string;
  formHint: string;
  customer: string;
  email: string;
  plan: string;
  starter: string;
  pro: string;
  create: string;
  creating: string;
  created: (name: string) => string;
  invalidName: string;
  invalidEmail: string;
  listTitle: string;
  listHint: string;
  searchPlaceholder: string;
  searchLabel: string;
  apply: string;
  all: string;
  open: string;
  paid: string;
  markPaid: string;
  markOpen: string;
  remove: string;
  empty: string;
  counts: (shown: number, total: number, open: number, paid: number) => string;
  detailTitle: string;
  back: string;
  order: string;
  amount: string;
  status: string;
  customerLabel: string;
  emailLabel: string;
  planLabel: string;
  connectionTitle: string;
  connectionHint: string;
  quick: readonly string[];
  createOrderDesc: string;
  customerParam: string;
  emailParam: string;
  planParam: string;
  createOrderExpect: string;
  searchDesc: string;
  applySearchDesc: string;
  filterDesc: string;
  markPaidDesc: (order: string) => string;
  markOpenDesc: (order: string) => string;
  removeDesc: (order: string) => string;
}

export const ORDERS: readonly Order[] = [
  { id: "SO-1001", customer: "Northwind", email: "ops@northwind.example", amount: 240, plan: "pro", status: "open" },
  { id: "SO-1002", customer: "Contoso", email: "billing@contoso.example", amount: 120, plan: "starter", status: "paid" },
  { id: "SO-1003", customer: "Fabrikam", email: "team@fabrikam.example", amount: 360, plan: "pro", status: "open" },
  { id: "SO-1004", customer: "Tailspin", email: "hello@tailspin.example", amount: 120, plan: "starter", status: "open" },
  { id: "SO-1005", customer: "Adventure Works", email: "support@adventure.example", amount: 240, plan: "pro", status: "paid" },
  { id: "SO-1006", customer: "Wingtip", email: "finance@wingtip.example", amount: 120, plan: "starter", status: "open" },
  { id: "SO-1007", customer: "Woodgrove", email: "orders@woodgrove.example", amount: 480, plan: "pro", status: "open" },
  { id: "SO-1008", customer: "Lucerne", email: "hello@lucerne.example", amount: 240, plan: "pro", status: "paid" },
  { id: "SO-1009", customer: "Proseware", email: "ops@proseware.example", amount: 120, plan: "starter", status: "open" },
  { id: "SO-1010", customer: "Trey Research", email: "admin@trey.example", amount: 360, plan: "pro", status: "open" },
  { id: "SO-1011", customer: "Blue Yonder", email: "team@blueyonder.example", amount: 120, plan: "starter", status: "paid" },
  { id: "SO-1012", customer: "Coho Vineyard", email: "orders@coho.example", amount: 240, plan: "pro", status: "open" },
  { id: "SO-1013", customer: "Alpine Ski House", email: "desk@alpine.example", amount: 120, plan: "starter", status: "open" },
  { id: "SO-1014", customer: "Margie's Travel", email: "book@margie.example", amount: 360, plan: "pro", status: "paid" },
  { id: "SO-1015", customer: "Fourth Coffee", email: "team@fourthcoffee.example", amount: 120, plan: "starter", status: "open" },
  { id: "SO-1016", customer: "Graphic Design Institute", email: "office@gdi.example", amount: 480, plan: "pro", status: "open" },
  { id: "SO-1017", customer: "Humongous Insurance", email: "claims@humongous.example", amount: 240, plan: "pro", status: "open" },
  { id: "SO-1018", customer: "City Power & Light", email: "billing@citypower.example", amount: 120, plan: "starter", status: "paid" },
];

const ENGLISH: Copy = {
  title: "Order desk",
  subtitle: "One small order page used to exercise the same Pling recipes in Vue 3.",
  switchLanguage: "中文",
  formTitle: "Create an order",
  formHint: "Validation runs before the write. The result is checked against the rendered list.",
  customer: "Customer",
  email: "Contact email",
  plan: "Plan",
  starter: "Starter",
  pro: "Pro",
  create: "Create order",
  creating: "Creating…",
  created: (name) => `Created the order for ${name}.`,
  invalidName: "Enter at least two characters.",
  invalidEmail: "Enter a valid email address.",
  listTitle: "Orders",
  listHint: "Search applies on button click. Rows remain individually addressable outside the visible area.",
  searchPlaceholder: "Search customer or order id",
  searchLabel: "Search orders",
  apply: "Apply",
  all: "All",
  open: "Open",
  paid: "Paid",
  markPaid: "Mark paid",
  markOpen: "Mark open",
  remove: "Delete",
  empty: "No orders match this view.",
  counts: (shown, total, open, paid) => `${shown} shown · ${total} total · ${open} open · ${paid} paid`,
  detailTitle: "Order detail",
  back: "Back to orders",
  order: "Order",
  amount: "Amount",
  status: "Status",
  customerLabel: "Customer",
  emailLabel: "Email",
  planLabel: "Plan",
  connectionTitle: "Model connection",
  connectionHint: "Vue 2.7 has no built-in settings panel. The host owns this form and recreates the dock after saving.",
  quick: [
    "Create an order for Blue Ridge, ops@blueridge.example, on the Pro plan",
    "Search for Contoso and tell me how many orders are shown",
    "Open order SO-1001",
  ],
  createOrderDesc: "Create one order from the order form",
  customerParam: "Customer name, 2–80 characters",
  emailParam: "Contact email address",
  planParam: "Subscription plan: starter or pro",
  createOrderExpect: "The new order is visible in the order list",
  searchDesc: "Type a customer name or order id into the order search field",
  applySearchDesc: "Apply the phrase currently typed in the order search field",
  filterDesc: "Filter the order list by payment status",
  markPaidDesc: (order) => `Mark order ${order} as paid`,
  markOpenDesc: (order) => `Mark order ${order} as open`,
  removeDesc: (order) => `Delete order ${order}`,
};

const CHINESE: Copy = {
  title: "订单工作台",
  subtitle: "用同一个订单页面，在 Vue 3 中走通 Pling 的几组实战方案。",
  switchLanguage: "English",
  formTitle: "新建订单",
  formHint: "先校验参数，再执行业务写入；提交后以页面中真实出现的订单作为成功判据。",
  customer: "客户",
  email: "联系邮箱",
  plan: "套餐",
  starter: "基础版",
  pro: "专业版",
  create: "创建订单",
  creating: "正在创建…",
  created: (name) => `已为 ${name} 创建订单。`,
  invalidName: "至少输入两个字符。",
  invalidEmail: "请输入有效的邮箱地址。",
  listTitle: "订单",
  listHint: "搜索在点击后应用；列表滚动时，视口外的行仍可按记录 id 引用。",
  searchPlaceholder: "搜索客户或订单号",
  searchLabel: "搜索订单",
  apply: "应用",
  all: "全部",
  open: "未付款",
  paid: "已付款",
  markPaid: "标记已付款",
  markOpen: "标记未付款",
  remove: "删除",
  empty: "当前视图没有匹配的订单。",
  counts: (shown, total, open, paid) => `显示 ${shown} 条 · 共 ${total} 条 · 未付款 ${open} 条 · 已付款 ${paid} 条`,
  detailTitle: "订单详情",
  back: "返回订单列表",
  order: "订单号",
  amount: "金额",
  status: "状态",
  customerLabel: "客户",
  emailLabel: "邮箱",
  planLabel: "套餐",
  connectionTitle: "模型连接",
  connectionHint: "Vue 2.7 没有内置设置面板。表单由宿主应用管理，保存后重建浮动助手。",
  quick: [
    "为 Blue Ridge 创建一条订单，邮箱 ops@blueridge.example，专业版",
    "搜索 Contoso，然后告诉我当前显示多少条订单",
    "打开订单 SO-1001",
  ],
  createOrderDesc: "使用订单表单新建一条订单",
  customerParam: "客户名称，2–80 个字符",
  emailParam: "联系邮箱地址",
  planParam: "套餐：starter 或 pro",
  createOrderExpect: "新订单已经出现在订单列表中",
  searchDesc: "在订单搜索框中输入客户名称或订单号",
  applySearchDesc: "应用搜索框中已经输入的短语",
  filterDesc: "按付款状态筛选订单列表",
  markPaidDesc: (order) => `将订单 ${order} 标记为已付款`,
  markOpenDesc: (order) => `将订单 ${order} 标记为未付款`,
  removeDesc: (order) => `删除订单 ${order}`,
};

export function copyFor(locale: Locale): Copy {
  return locale === "zh" ? CHINESE : ENGLISH;
}
