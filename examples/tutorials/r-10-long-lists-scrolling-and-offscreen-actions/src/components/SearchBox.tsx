import { forwardRef } from "react";

export interface SearchBoxProps {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export const SearchBox = forwardRef<HTMLDivElement, SearchBoxProps>(function SearchBox(
  { value, label, placeholder, onChange, onSearch },
  ref,
) {
  return (
    <div className="search-box" ref={ref}>
      <span className="search-box__icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        aria-label={label}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSearch();
        }}
      />
    </div>
  );
});
