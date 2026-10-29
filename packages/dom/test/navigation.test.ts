import { describe, expect, it } from "vitest";
import { sameOriginUrl } from "../src/navigation";

describe("sameOriginUrl", () => {
  const base = "http://localhost:3000/demo/detail.html?id=c1";

  it("相对地址按当前 document 解析", () => {
    expect(sameOriginUrl("./index.html", base)).toBe("http://localhost:3000/demo/index.html");
  });

  it("同源绝对地址原样返回", () => {
    expect(sameOriginUrl("/orders?status=open", base)).toBe("http://localhost:3000/orders?status=open");
  });

  it("跨源与非法地址会被拒绝", () => {
    expect(sameOriginUrl("https://evil.example/steal", base)).toBeNull();
    expect(sameOriginUrl("javascript:alert(1)", base)).toBeNull();
    expect(sameOriginUrl("", base)).toBeNull();
  });
});
