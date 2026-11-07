import { describe, expect, it } from "vitest";
import { PRIMITIVE_KIND_FLOOR, resolveKind } from "../src/types";
import { PRIMITIVE_PARAMS, validateArgs } from "../src/primitives";

describe("hover 原语（S6b-2）", () => {
  it("没有参数；kind 下限是 read", () => {
    expect(PRIMITIVE_PARAMS.hover).toEqual({ type: "object", properties: {}, required: [] });
    expect(PRIMITIVE_KIND_FLOOR.hover).toBe("read");
    expect(() => validateArgs("hover", {})).not.toThrow();
  });

  it("省略声明时仍按 fail-closed 视为 write", () => {
    expect(resolveKind("hover")).toBe("write");
    expect(resolveKind("hover", "read")).toBe("read");
  });

  it("select accepts one value or a list for multiple-select controls", () => {
    expect(PRIMITIVE_PARAMS.select.properties?.value).toMatchObject({
      oneOf: [
        { type: "string" },
        { type: "array", items: { type: "string" } },
      ],
    });
    expect(() => validateArgs("select", { value: ["a", "b"] })).not.toThrow();
    expect(() => validateArgs("select", {})).toThrow(/Missing required parameter: value/);
  });
});
