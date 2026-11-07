# @plingjs/agent

The isomorphic agent layer for Pling. It turns declared page capabilities into a
real conversation while remaining independent of Vue, React, and browser UI.

```bash
npm install @plingjs/agent
```

Create a runtime from a Pling registry and a model configuration:

```ts
import { createAgentRuntime, resolveAgentConfig } from "@plingjs/agent";

const runtime = createAgentRuntime({
  registry: pling.registry,
  config: resolveAgentConfig({
    env: import.meta.env,
    baseUrl: "/api/llm/v1",
    model: "your-model",
  }),
  gate: () => true,
});
```

The package owns the agent loop, bounded context assembly, history compaction,
tool protocols, confirmation queues, handoff, hooks, continuity checkpoints,
retries, telemetry, deterministic replay, and evaluation helpers.

Provider credentials belong in a server-side gateway. `@plingjs/agent` can call
any OpenAI-compatible `/chat/completions` endpoint, including `@plingjs/server`.

## Guided tasks

Guided tasks describe a human outcome once: its objective, constraints, success
criteria, fields, and any deterministic business steps. While a task is active,
the model receives the current values as working memory and can answer a
question, update one field, or leave the task untouched. The task layer has no
second executor and no second permission model.

```ts
import { createTaskController } from "@plingjs/agent";

const tasks = createTaskController({
  invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
});

tasks.register({
  id: "student.cards",
  title: "Find a student's membership cards",
  objective: "Find the right student and show their usable membership cards.",
  constraints: ["Ask the person to choose when names are ambiguous."],
  successCriteria: ["The cards belong to the student the person confirmed."],
  fields: [{
    name: "studentRef",
    label: "Student",
    type: "lookup",
    minChars: 2,
    recommended: "student_li_na",
    lookup: searchStudents,
  }],
  steps: [{
    label: "Read membership cards",
    action: "get_student_cards",
    args: (values) => ({ studentId: values.studentRef }),
  }],
});
```

Use `prompt` instead of `steps` when the route cannot be fixed safely. The
controller returns a prompt; the host sends it through its existing assistant
session. `@plingjs/vanilla` provides a reference DOM panel.

`recommended` values are suggestions for an explicit delegation such as “choose
for me”, not automatic writes. Set `agentWritable: false` for page-owned values
such as an uploaded file or a one-time code. The task catalog exposes
`pling_start_task` and `pling_update_task`; the latter can update only the
active task and only declared, agent-writable fields.

Field constraints (`min`, `max`, `minLength`, `maxLength`, `pattern`, and a
business `validate(value, values)`) run before a model-proposed value reaches
the task snapshot. A rejected value changes nothing, so the page never shows a
half-applied update.

The page may also expose four narrow control tools: `pling_focus_field`,
`pling_review_task`, `pling_propose_save`, and `pling_cancel_task`. They exist
only when the guide's `agent` block declares the matching `review`,
`proposeSave`, and `cancel` commands; `pling_focus_field` is limited to declared
guide fields. `pling_propose_save` opens the page's confirmation surface and
never performs the business write. Confirmation remains human-only.

### Bind the selected page record

Some tasks only make sense for a record the user has already selected, such as a
course row. Declare `requiresRecord: true` and pass the record when the task
starts. The id stays page context instead of becoming an editable field:

```ts
tasks.register({
  id: "lesson.note",
  title: "Write a lesson note",
  requiresRecord: true,
  fields: [{ name: "note", label: "Note", type: "textarea" }],
  steps: [{
    label: "Save the lesson note",
    action: "update_lesson_note",
    args: (values, binding) => ({
      lessonId: binding.record?.id,
      note: values.note,
    }),
  }],
});

tasks.start("lesson.note", {}, {
  record: { id: lesson.id, label: `${lesson.course} · ${lesson.date}` },
});
```

`start()` rejects a `requiresRecord` task when `binding.record.id` is empty.
The binding identifies a record; it does not grant permission. The executor and
the server still verify ownership, scope, and write access.

Fields that accept a human-readable search can use `lookup` together with
`searchAction` and `minChars`. `registerTaskLookupActions` from
`@plingjs/vanilla` exposes the same search as a narrow read action.

## Documentation

- [How one agent run works](https://plingjs.dev/concepts/how-one-agent-run-works)
- [Agent runtime, sessions, context, and limits](https://plingjs.dev/reference/agent-runtime-sessions-context-limits)
- [Guided task API](https://plingjs.dev/reference/guided-task-api)
- [Connect a model gateway](https://plingjs.dev/operations/connect-a-model-gateway)
- [Error codes and diagnostics](https://plingjs.dev/reference/error-codes-and-diagnostics)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
