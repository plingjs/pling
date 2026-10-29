import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling } from "../src";

describe("v-tool fill on a v-model input", () => {
  it("registers the action and updates the bound ref through the native input event", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const query = ref("");
    const Host = defineComponent({
      template: `
        <input
          id="search"
          v-model="query"
          type="search"
          v-tool="{ id: 'order_search', action: 'fill', desc: 'Filter the order queue' }"
        />
      `,
      setup: () => ({ query }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.get("order_search")).toBeDefined();
    const executor = createExecutor({ registry: pi.registry, policy: createPolicy(async () => true) });
    const result = await executor.execute("order_search", JSON.stringify({ text: "high" }));

    expect(result).toMatchObject({ result: { ok: true } });
    expect(query.value).toBe("high");
    expect((wrapper.get("#search").element as HTMLInputElement).value).toBe("high");

    wrapper.unmount();
  });
});
