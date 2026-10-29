import { describe, expect, it } from "vitest";
import { createExecutor } from "../src/executor";
import { createPolicy } from "../src/policy";
import { createRegistry } from "../src/registry";
import { createTokenVault, maskText, sensitive } from "../src/sensitivity";
import { sanitizeState } from "../src/state";

/**
 * 敏感数据（S14）：模型知道「这里有手机号」，但看不到号码。
 *
 * 四个模式、两条边界，必须一条一条锁死：
 *   hidden  只留字段名
 *   masked  保留形状（前 3 后 4）
 *   token   给代号；执行前才换回真值（模型的「能用但看不见」）
 *   hint    只给类型说明
 *
 * 两条边界：
 *   · 没有保险箱时 token 必须退化成隐藏（不能把真值写进快照）；
 *   · 模型编了一个不存在的 token 必须报错，不能猜。
 */

const allowAll = createPolicy(async () => true);

describe("sanitizeState：四种模式", () => {
  const vault = createTokenVault({ salt: "test" });

  it("hidden 只留字段名；masked 保留形状；hint 给类型", () => {
    const out = sanitizeState(
      {
        客户: "张三",
        手机: sensitive("13812341234"),
        证件: sensitive("110101199001011234", "masked"),
        备注: sensitive("内部评级 A", { mode: "hint", hint: "客户等级" }),
      },
      {},
      { vault },
    ) as Record<string, unknown>;

    expect(out).toEqual({
      客户: "张三",
      手机: "[hidden]",
      证件: "110***********1234",
      备注: "[客户等级]",
    });
  });

  it("token 模式：稳定、不可逆，同一个值永远同一个代号", () => {
    const first = sanitizeState({ 手机: sensitive("13812341234", "token") }, {}, { vault }) as Record<string, string>;
    const second = sanitizeState({ 手机: sensitive("13812341234", "token") }, {}, { vault }) as Record<string, string>;
    const other = sanitizeState({ 手机: sensitive("13900000000", "token") }, {}, { vault }) as Record<string, string>;

    expect(first.手机).toMatch(/^\{\{p:[0-9a-z]{7}\}\}$/);
    expect(second.手机).toBe(first.手机);
    expect(other.手机).not.toBe(first.手机);
    expect(first.手机).not.toContain("138");
  });

  it("没有保险箱时 token 退化成隐藏（fail-closed）", () => {
    const out = sanitizeState({ 手机: sensitive("13812341234", "token") }) as Record<string, string>;
    expect(out.手机).toBe("[hidden]");
  });

  it("嵌在数组 / 对象里也照样脱敏", () => {
    const out = sanitizeState({ list: [{ name: "张三", phone: sensitive("13812341234") }] }, {}, { vault }) as Record<
      string,
      Array<Record<string, string>>
    >;
    expect(out.list![0]).toEqual({ name: "张三", phone: "[hidden]" });
  });

  it("null / undefined 不值得遮（它们本来就没有值）", () => {
    const out = sanitizeState({ a: sensitive(null), b: sensitive(undefined) }, {}, { vault }) as Record<string, unknown>;
    expect(out).toEqual({ a: null, b: null });
  });

  it("maskText 的通用规则", () => {
    expect(maskText("")).toBe("");
    expect(maskText("张三")).toBe("**");
    expect(maskText("张")).toBe("*");
    expect(maskText("13812341234")).toBe("138****1234");
  });
});

describe("保险箱：代号 ↔ 真值", () => {
  it("同一个值 → 同一个 token；换一个盐 → 换一批 token", () => {
    const a = createTokenVault({ salt: "a" });
    const b = createTokenVault({ salt: "b" });
    expect(a.tokenOf("13812341234")).toBe(a.tokenOf("13812341234"));
    expect(a.tokenOf("13812341234")).not.toBe(b.tokenOf("13812341234"));
  });

  it("resolve 能把代号换回真值；未知代号原样保留", () => {
    const vault = createTokenVault({ salt: "t" });
    const token = vault.tokenOf("13812341234");
    expect(vault.resolve(`打给 ${token}`)).toBe("打给 13812341234");
    expect(vault.resolve("打给 {{p:zzzzzzz}}")).toBe("打给 {{p:zzzzzzz}}");
  });

  it("unknownTokens 只报「像 token 但保险箱里没有」的", () => {
    const vault = createTokenVault({ salt: "t" });
    const token = vault.tokenOf("13812341234");
    expect(vault.unknownTokens({ a: token, b: "{{p:nothere}}" })).toEqual(["{{p:nothere}}"]);
    expect(vault.unknownTokens({ a: "普通文本" })).toEqual([]);
  });

  it("redact：出站文本里的真值换回代号（长值优先，不误伤短词）", () => {
    const vault = createTokenVault({ salt: "t" });
    const phone = vault.tokenOf("13812341234");
    const short = vault.tokenOf("张三");
    expect(vault.redact("客户 张三 的电话是 13812341234")).toBe(`客户 ${short} 的电话是 ${phone}`);
  });
});

describe("执行：token 只在最后一刻还原", () => {
  it("模型把 {{p:…}} 填进参数 → run 拿到真值", async () => {
    const registry = createRegistry({ tokenSalt: "t" });
    const vault = registry.tokens;
    const token = vault.tokenOf("13812341234");
    let received = "";
    registry.bind({
      descriptor: {
        id: "call_customer",
        primitive: "click",
        description: "给客户打电话",
        kind: "write",
        params: {
          type: "object",
          properties: { phone: { type: "string", description: "客户电话（页面给的代号）" } },
          required: ["phone"],
        },
      },
      isAvailable: () => true,
      run: async (args) => {
        received = String(args.phone);
      },
    });

    const out = await createExecutor({ registry, policy: allowAll }).execute(
      "call_customer",
      JSON.stringify({ phone: token }),
    );

    expect(out).toMatchObject({ result: { ok: true } });
    expect(received).toBe("13812341234");
  });

  it("模型编了一个不存在的 token → INVALID_ARGS，不执行", async () => {
    const registry = createRegistry({ tokenSalt: "t" });
    let ran = false;
    registry.bind({
      descriptor: {
        id: "call_customer",
        primitive: "click",
        description: "给客户打电话",
        kind: "write",
        params: {
          type: "object",
          properties: { phone: { type: "string" } },
          required: ["phone"],
        },
      },
      isAvailable: () => true,
      run: async () => {
        ran = true;
      },
    });

    const out = await createExecutor({ registry, policy: allowAll }).execute(
      "call_customer",
      JSON.stringify({ phone: "{{p:madeup1}}" }),
    );

    expect(out).toMatchObject({ error: { code: "INVALID_ARGS" } });
    expect(ran).toBe(false);
  });

  it("业务抛错里带着真值 → 回执里是代号", async () => {
    const registry = createRegistry({ tokenSalt: "t" });
    const token = registry.tokens.tokenOf("13812341234");
    registry.bind({
      descriptor: { id: "save", primitive: "click", description: "保存", kind: "write" },
      isAvailable: () => true,
      run: async () => {
        throw new Error("客户 13812341234 已存在");
      },
    });

    const out = await createExecutor({ registry, policy: allowAll }).execute("save", "{}");
    expect(JSON.stringify(out)).toContain(`客户 ${token} 已存在`);
    expect(JSON.stringify(out)).not.toContain("13812341234");
  });
});

describe("快照：记录与状态都不漏真值", () => {
  it("v-record 的 fields 与 useAgentState 走同一条脱敏管线", () => {
    const registry = createRegistry({ tokenSalt: "t" });
    registry.declareRecord({
      id: "SO-1",
      fields: { 客户: "张三", 手机: sensitive("13812341234"), 证件: sensitive("110101199001011234", "masked") },
    });
    registry.expose({ key: "me", read: () => ({ name: "李四", phone: sensitive("13700000000") }) });

    const snapshot = registry.snapshot();
    expect(snapshot.records[0]!.fields).toEqual({
      客户: "张三",
      手机: "[hidden]",
      证件: "110***********1234",
    });
    expect(snapshot.state.me).toEqual({ name: "李四", phone: "[hidden]" });
    expect(JSON.stringify(snapshot)).not.toContain("13812341234");
  });
});
