import { forwardRef } from "react";

export type TaskFilter = "all" | "active" | "completed";

export interface TaskFiltersProps {
  value: TaskFilter;
  groupLabel: string;
  labels: { all: string; active: string; completed: string };
  onChange: (value: TaskFilter) => void;
}

export const TaskFilters = forwardRef<HTMLDivElement, TaskFiltersProps>(function TaskFilters(
  { value, groupLabel, labels, onChange },
  ref,
) {
  return (
    <div className="filters" role="group" aria-label={groupLabel} ref={ref}>
      {(["all", "active", "completed"] as const).map((filter) => (
        <button
          key={filter}
          type="button"
          data-filter={filter}
          className={value === filter ? "is-active" : undefined}
          aria-pressed={value === filter}
          onClick={() => onChange(filter)}
        >
          {labels[filter]}
        </button>
      ))}
    </div>
  );
});
