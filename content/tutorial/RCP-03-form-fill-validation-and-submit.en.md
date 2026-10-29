---
id: RCP-03
title: "Form fill, validation, and submit"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Form fill, validation, and submit

An agent that fills three fields and clicks “Save” is easy to build and easy to get wrong. The hard parts are deciding what the model may submit, keeping validation authoritative, and reporting the difference between “the click happened” and “the record was created”.

This recipe treats the form as one business operation. The model supplies the values; the application still owns validation and persistence.

## Runnable page

The invoice form below exercises field validation, an unavailable state during submission, a business-policy rejection, and a successful receipt. The model may supply values, but it does not bypass the application's own checks.

<DemoPlayground id="recipe-form-validation" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-form-validation/`. The source is in `examples/demos/recipe-form-validation/`; the fixture is frontend-only, and a local business policy stands in for a server rejection.

## The task

The user says:

> “Create a customer named Northwind, email ops@northwind.example, on the Pro plan.”

The page exposes a `create_customer` action with three required parameters. It also exposes a small read-only view showing whether the form is dirty, submitting, or blocked by validation.

Do not expose one action for every field unless the user genuinely needs to edit them independently. A single operation gives the model one success condition and gives the application one place to validate the whole request.

## Declare the operation

```ts
useAgentTool({
  id: "create_customer",
  desc: "Create a customer from the customer form",
  kind: "write",
  params: [
    { name: "name", label: "Customer name", minLength: 2, maxLength: 80 },
    { name: "email", label: "Contact email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { name: "plan", label: "Subscription plan", values: ["starter", "pro"] },
  ],
  available: () => (submitting.value ? "A save is already in progress" : true),
  run: async (args) => {
    await saveCustomer({
      name: String(args.name),
      email: String(args.email),
      plan: String(args.plan),
    });
  },
  expect: {
    desc: "The new customer appears in the table",
    check: () => rows.value.some((row) => row.id === savedCustomerId.value),
  },
});
```

The parameter contract runs before `run`. Missing fields, an invalid email shape, or a plan outside `starter / pro` produce `INVALID_PARAMS`; the business function is not called.

`available` answers a different question: whether the operation can start at all. It is not a replacement for parameter validation. A disabled form, a read-only workspace, or an in-flight save belongs here.

`expect` closes the remaining UI gap. It runs only after `run` resolves successfully and waits for the observable business result. A backend rejection inside `run` is reported as `EXECUTION_FAILED`; an `expect` condition that never becomes true is reported as `EXPECTATION_FAILED`.

## Expose form state without exposing sensitive values

```ts
useAgentState(
  "customer_form",
  () => ({
    dirty: formIsDirty.value,
    submitting: submitting.value,
    invalidFields: invalidFields.value,
    lastSaveFailed: lastError.value !== null,
  }),
  {
    description: "Customer form status; values are not repeated in page state",
  },
);
```

This view answers “why can’t the form be submitted?” without duplicating the email, phone number, or notes into the model context. Expose the field names that need attention, not their contents. If the model needs to compare an old and new value, expose a deliberate, bounded diff instead of the whole form.

## Adapter implementations

### Vue 3

```ts
import { ref } from "vue";
import { useAgentState, useAgentTool } from "@plingjs/vue";

const submitting = ref(false);
const savedCustomerId = ref<string | null>(null);

useAgentTool({
  id: "create_customer",
  desc: "Create a customer from the customer form",
  kind: "write",
  params: [
    { name: "name", label: "Customer name", minLength: 2 },
    { name: "email", label: "Contact email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { name: "plan", label: "Plan", values: ["starter", "pro"] },
  ],
  available: () => !submitting.value,
  run: async (args) => {
    submitting.value = true;
    try {
      const customer = await api.createCustomer(args as CustomerInput);
      savedCustomerId.value = customer.id;
    } finally {
      submitting.value = false;
    }
  },
  expect: {
    desc: "The customer is visible in the table",
    check: () => rows.value.some((row) => row.id === savedCustomerId.value),
  },
});
```

### React

```tsx
import { useRef, useState } from "react";
import { useAgentTool } from "@plingjs/react";

export function CustomerForm() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lastCreated = useRef<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useAgentTool({
    id: "create_customer",
    desc: "Create a customer from the customer form",
    kind: "write",
    params: [
      { name: "name", label: "Customer name", minLength: 2 },
      { name: "email", label: "Contact email", pattern: EMAIL },
      { name: "plan", label: "Plan", values: ["starter", "pro"] },
    ],
    available: () => !submitting,
    run: async (args) => {
      setSubmitting(true);
      try {
        const customer = await api.createCustomer(args as CustomerInput);
        lastCreated.current = customer.id;
        setRows((current) => [...current, customer]);
      } finally {
        setSubmitting(false);
      }
    },
    expect: {
      desc: "The customer appears in the table",
      check: () => rowsRef.current.some((row) => row.id === lastCreated.current),
    },
  });

  return <form>{/* name, email, and plan fields */}</form>;
}
```

### Vanilla / jQuery

```ts
const off = pling.action({
  id: "create_customer",
  desc: "Create a customer from the customer form",
  kind: "write",
  params: [
    { name: "name", label: "Customer name", minLength: 2 },
    { name: "email", label: "Contact email", pattern: EMAIL },
    { name: "plan", label: "Plan", values: ["starter", "pro"] },
  ],
  available: () => !state.submitting,
  run: async (args) => {
    state.submitting = true;
    try {
      const customer = await api.createCustomer(args);
      state.savedId = customer.id;
      appendRow(customer);
    } finally {
      state.submitting = false;
    }
  },
  expect: {
    desc: "The new customer is visible",
    check: () => document.querySelector(`[data-customer="${state.savedId}"]`) !== null,
  },
});
```

### Vue 2.7

```ts
import { defineComponent, onBeforeUnmount, ref } from "vue";
import { useAgentState, usePling } from "@plingjs/vue2";

export default defineComponent({
  setup() {
    const pling = usePling();
    const submitting = ref(false);
    const savedCustomerId = ref<string | null>(null);

    const off = pling.action({
      id: "create_customer",
      desc: "Create a customer from the customer form",
      kind: "write",
      params: [
        { name: "name", label: "Customer name", minLength: 2 },
        { name: "email", label: "Contact email", pattern: EMAIL },
        { name: "plan", label: "Plan", values: ["starter", "pro"] },
      ],
      available: () => !submitting.value,
      run: async (args) => {
        submitting.value = true;
        try {
          const customer = await api.createCustomer(args);
          savedCustomerId.value = customer.id;
        } finally {
          submitting.value = false;
        }
      },
      expect: {
        desc: "The customer is visible in the table",
        check: () => document.querySelector(`[data-customer="${savedCustomerId.value}"]`) !== null,
      },
    });

    onBeforeUnmount(off);

    useAgentState("customer_form", () => ({ submitting: submitting.value }), {
      description: "Customer form status",
    });

    return { submitting };
  },
});
```

## Execution sequence

1. The user supplies the values in chat.
2. The runtime validates them against the declared parameters.
3. `available()` confirms the form can accept a save.
4. `run()` calls the same business function as the visible submit button.
5. The application or server validates the request again.
6. `expect()` waits for the row or success state that proves the save took effect.
7. The next snapshot contains the new record and any updated form state.

A field error from the backend should be returned as a real error with a recovery message. Do not convert it into a successful action followed by a generic apology.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `INVALID_PARAMS` for a value the UI accepts | The declared pattern or bounds are stricter than the business rule | Make the action contract match the server rule |
| The model fills fields but nothing is saved | The form has separate fill actions and no submit action | Expose one atomic submit operation or explicitly require both calls |
| The click succeeds but no record exists | The action reports DOM interaction, not the business result | Add `expect` and return backend errors unchanged |
| A second save overwrites the first | `available()` ignores the in-flight request | Block while `submitting` is true |
| Sensitive values appear twice in context | State repeats every field value | Expose status and field names, not field contents |
| The model retries after a validation error with the same value | The error did not explain the recovery condition | Include the expected format and the rejected field |

## Security boundary

Client-side validation gives fast feedback; it is not authorization. The save endpoint must authenticate the caller, enforce tenant scope, validate again, and reject forbidden plans or fields.

If the form contains passwords, payment details, government identifiers, or one-time codes, do not expose those values as ordinary parameters. Use a handoff or a server-side flow that never places the secret in model context.

## Evidence

- Parameter validation: `packages/core/src/params.ts`.
- Runnable source for this recipe: `examples/demos/recipe-form-validation/`.

## Local verification

Submit an empty form, then use `Blocked Co` to trigger the business rejection, and finally enter valid values. The three attempts should end as a parameter error, a business error, and a receipt. The model must not turn either rejection into success.

