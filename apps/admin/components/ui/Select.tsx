"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

/**
 * Drop-in replacement for <select> with a themed dropdown.
 *
 * Takes the same props and the same <option> children as a native select,
 * so swapping one in is just renaming the tag. A real (visually hidden)
 * <select> stays in the DOM as the source of truth: it carries `name`,
 * `required`, `value`/`defaultValue` and `onChange`, so form submission,
 * native required-validation, FormData and existing `onChange={(e) =>
 * e.target.value}` handlers all keep working. Picking an option sets the
 * hidden select's value and dispatches a real `change` event on it.
 */

type OptionItem = { value: string; label: string; disabled: boolean };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function collectOptions(children: ReactNode, out: OptionItem[] = []): OptionItem[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === Fragment || el.type === "optgroup") {
      collectOptions(el.props.children, out);
      return;
    }
    if (el.type === "option") {
      const label = textOf(el.props.children);
      out.push({ value: el.props.value !== undefined ? String(el.props.value) : label, label, disabled: Boolean(el.props.disabled) });
    }
  });
  return out;
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true">
      <path d="m6 8 4 4 4-4" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="m5 10.5 3.2 3L15 6.5" />
    </svg>
  );
}

const defaultTrigger =
  "h-10 rounded-[10px] border border-border bg-white px-3 text-sm text-text shadow-[0_1px_1px_rgba(16,24,20,0.03)] hover:border-text-muted/40";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Placeholder shown when the current value matches no option. */
  placeholder?: string;
};

export function Select({ children, className, value, defaultValue, placeholder, disabled, id, "aria-label": ariaLabel, ...rest }: SelectProps) {
  const options = useMemo(() => collectOptions(children), [children]);
  const isControlled = value !== undefined;
  const [inner, setInner] = useState<string>(() => String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""));
  const current = isControlled ? String(value ?? "") : inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number; flipUp: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const listId = useId();
  const autoId = useId();
  const triggerId = id ?? autoId;

  const searchable = options.length > 8;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    // top: just below the trigger; bottom: distance from the viewport bottom to just above it (used when flipping up).
    setRect({ left: r.left, top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, width: Math.max(r.width, 200), flipUp: spaceBelow < 280 && r.top > spaceBelow });
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    place();
    setQuery("");
    const idx = options.findIndex((o) => o.value === current);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }, [disabled, place, options, current]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Reposition / close while open.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onDown);
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, place, close, searchable]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: OptionItem) {
    if (option.disabled) return;
    if (!isControlled) setInner(option.value);
    const native = nativeRef.current;
    if (native && native.value !== option.value) {
      native.value = option.value;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
  }

  function move(delta: number) {
    if (visible.length === 0) return;
    let i = active;
    for (let step = 0; step < visible.length; step++) {
      i = (i + delta + visible.length) % visible.length;
      if (!visible[i].disabled) break;
    }
    setActive(i);
  }

  function onListKey(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(visible.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (visible[active]) choose(visible[active]);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!searchable && e.key.length === 1) {
          const now = Date.now();
          typeahead.current.text = now - typeahead.current.at > 600 ? e.key.toLowerCase() : typeahead.current.text + e.key.toLowerCase();
          typeahead.current.at = now;
          const hit = visible.findIndex((o) => o.label.toLowerCase().startsWith(typeahead.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  // Layout classes from the old <select> (w-full, flex-1, max-w-*, col-span-*...) have to size the wrapper too, not just the button.
  const layoutClasses = (className ?? "")
    .split(/\s+/)
    .filter((c) => /^(?:[a-z]+:)?(?:w-|min-w-|max-w-|flex-|basis-|grow|shrink|col-span|self-|justify-self)/.test(c))
    .join(" ");

  return (
    <span className={`relative inline-flex min-w-0 align-middle ${layoutClasses}`} data-select="">
      {/* The real select: form value, validation and onChange. Visually hidden but focusable for native validation messages. */}
      <select
        {...rest}
        ref={nativeRef}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : defaultValue}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onFocus={() => triggerRef.current?.focus()}
        onChange={(e) => {
          if (!isControlled) setInner(e.target.value);
          rest.onChange?.(e);
        }}
      >
        {children}
      </select>

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={open ? onListKey : onTriggerKey}
        className={`relative flex w-full min-w-[150px] items-center justify-between gap-2 text-left transition-colors focus:outline-none focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-brand-primary ring-2 ring-brand-primary/15" : ""
        } ${className ?? defaultTrigger}`}
      >
        <span className={`truncate ${selected ? "" : "text-text-muted"}`}>{selected?.label ?? placeholder ?? "Select…"}</span>
        <Chevron />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={listRef}
            onKeyDown={onListKey}
            style={{
              position: "fixed",
              left: rect.left,
              width: rect.width,
              ...(rect.flipUp ? { bottom: rect.bottom } : { top: rect.top }),
            }}
            className="z-[100] overflow-hidden rounded-xl border border-border bg-white shadow-[0_12px_32px_-8px_rgba(16,24,20,0.22),0_2px_6px_rgba(16,24,20,0.06)]"
          >
            {searchable && (
              <div className="border-b border-border p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Search…"
                  aria-label="Search options"
                  className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
            )}
            <div id={listId} role="listbox" aria-labelledby={triggerId} tabIndex={-1} className="max-h-64 overflow-y-auto p-1.5">
              {visible.length === 0 && <p className="px-3 py-2 text-sm text-text-muted">No matches</p>}
              {visible.map((o, i) => {
                const isSelected = o.value === current;
                const isActive = i === active;
                return (
                  <div
                    key={`${o.value}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      o.disabled
                        ? "cursor-not-allowed text-text-muted/60"
                        : isActive
                          ? "bg-brand-primary/[0.08] text-text"
                          : "text-text"
                    } ${isSelected ? "font-semibold text-brand-primary" : ""}`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && <Check />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
