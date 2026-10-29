import { forwardRef, useState, type Ref } from "react";

export interface BulkMenuProps {
  label: string;
  clearLabel: string;
  clearRef: Ref<HTMLButtonElement>;
  completed: number;
  onClear: () => void;
}

export const BulkMenu = forwardRef<HTMLDivElement, BulkMenuProps>(function BulkMenu(
  { label, clearLabel, clearRef, completed, onClear },
  ref,
) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bulk"
      ref={ref}
      onMouseOver={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="bulk__trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <div className="bulk__menu">
          <button
            ref={clearRef}
            className="todo__clear"
            type="button"
            disabled={completed === 0}
            onClick={onClear}
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
});
