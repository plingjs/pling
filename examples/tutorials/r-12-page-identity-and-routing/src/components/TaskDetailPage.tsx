import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  usePlingRecord,
  usePlingScope,
  usePlingState,
  usePlingTool,
} from "@plingjs/react";
import type { DemoCopy } from "../copy";
import type { Task } from "../tasks";

export interface TaskDetailPageProps {
  tasks: Task[];
  copy: DemoCopy;
  onToggleTask: (id: string) => void;
}

export function TaskDetailPage({ tasks, copy, onToggleTask }: TaskDetailPageProps) {
  const { id = "" } = useParams();
  const task = tasks.find((item) => item.id === id) ?? null;
  const detailScope = usePlingScope<HTMLElement>({
    id: "task_detail",
    label: copy.detailRegionLabel,
    description: copy.detailRegionDescription,
    role: "main",
  });
  const backRef = usePlingTool<HTMLAnchorElement>({
    id: "back_to_tasks",
    desc: copy.backToTasksDesc,
    kind: "read",
  });

  usePlingState(
    "task_detail",
    () => task
      ? {
          id: task.id,
          status: task.done ? "completed" : "open",
          priority: task.priority,
          found: true,
        }
      : { id, found: false },
    { description: copy.detailStateDescription },
  );

  return (
    <section className="todo detail" ref={detailScope}>
      <Link className="back-link" ref={backRef} to="/tasks">
        ← {copy.backToTasks}
      </Link>

      {task ? (
        <TaskDetailBody task={task} copy={copy} onToggleTask={onToggleTask} />
      ) : (
        <div className="detail__missing">
          <p className="todo__eyebrow">{copy.detailEyebrow}</p>
          <h1>{copy.taskNotFound}</h1>
          <p>{copy.taskNotFoundHint(id)}</p>
        </div>
      )}
    </section>
  );
}

function TaskDetailBody({
  task,
  copy,
  onToggleTask,
}: {
  task: Task;
  copy: DemoCopy;
  onToggleTask: (id: string) => void;
}) {
  const taskRef = useRef(task);
  const expectedDone = useRef<boolean | null>(null);
  taskRef.current = task;

  const cardRef = usePlingRecord<HTMLElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? "completed" : "open",
      priority: copy.priorities[task.priority],
    },
  });
  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: "toggle_task_status",
    desc: copy.toggleDetailDesc(task.text, task.done),
    kind: "write",
    run: () => {
      expectedDone.current = !taskRef.current.done;
      onToggleTask(taskRef.current.id);
    },
    expect: {
      desc: copy.toggleDetailExpect,
      check: () => taskRef.current.done === expectedDone.current,
    },
  });

  return (
    <>
      <header className="todo__header">
        <div>
          <p className="todo__eyebrow">{copy.detailEyebrow}</p>
          <h1>{task.text}</h1>
        </div>
        <p className="todo__count">{copy.detailTaskId(task.id)}</p>
      </header>

      <article className="detail__card" ref={cardRef}>
        <dl className="detail__facts">
          <div>
            <dt>{copy.statusLabel}</dt>
            <dd>{task.done ? copy.completedLabel : copy.openLabel}</dd>
          </div>
          <div>
            <dt>{copy.priorityLabel}</dt>
            <dd>{copy.priorities[task.priority]}</dd>
          </div>
        </dl>
        <p className="detail__note">{copy.detailNote}</p>
      </article>

      <div className="detail__actions">
        <button
          className="detail__toggle"
          ref={toggleRef}
          type="button"
          onClick={() => {
            expectedDone.current = !task.done;
            onToggleTask(task.id);
          }}
        >
          {task.done ? copy.markOpen : copy.markCompleted}
        </button>
      </div>
    </>
  );
}
