"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type Tone = "default" | "danger" | "warning";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** Small line under the message, e.g. what it costs. */
  note?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

export interface PromptOptions {
  title: string;
  message?: ReactNode;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
}

type Request =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

interface Api {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<Api | null>(null);

const TONES: Record<Tone, { badge: string; button: string; icon: ReactNode }> = {
  default: {
    badge: "bg-brand-primary/10 text-brand-primary",
    button: "bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm shadow-brand-primary/25",
    icon: <path d="M10 6.5v4M10 13.5h.01M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" />,
  },
  warning: {
    badge: "bg-amber-50 text-amber-600",
    button: "bg-amber-500 text-white hover:bg-amber-600",
    icon: <path d="M10 7.5v3.5M10 14h.01M8.6 3.8 2.9 14a1.6 1.6 0 0 0 1.4 2.4h11.4a1.6 1.6 0 0 0 1.4-2.4L11.4 3.8a1.6 1.6 0 0 0-2.8 0Z" />,
  },
  danger: {
    badge: "bg-red-50 text-red-600",
    button: "bg-red-600 text-white hover:bg-red-700",
    icon: <path d="M4 6h12M8 6V4.5h4V6M6 6l.6 9.5h6.8L14 6M8.5 9v3.5M11.5 9v3.5" />,
  },
};

/**
 * One consistent, accessible dialog for the whole admin (replaces the browser's
 * confirm()/prompt() pop-ups). Mounted once in the dashboard layout; use it via
 * useDialogs().confirm(...) / .prompt(...), which return promises.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setReq({ kind: "confirm", opts, resolve })), []);
  const prompt = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.initialValue ?? "");
        setReq({ kind: "prompt", opts, resolve });
      }),
    []
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (req && !d.open) d.showModal();
    if (!req && d.open) d.close();
  }, [req]);

  function finish(ok: boolean) {
    if (!req) return;
    if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok && value.trim() ? value.trim() : null);
    setReq(null);
  }

  const tone = TONES[(req?.kind === "confirm" ? req.opts.tone : undefined) ?? "default"];

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          finish(false); // Esc
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) finish(false); // backdrop
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-white p-0 text-text shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      >
        {req && (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              finish(true);
            }}
            className="flex flex-col gap-5 p-6"
          >
            <div className="flex items-start gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  {tone.icon}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-text">{req.opts.title}</h2>
                {req.opts.message && <p className="mt-1 text-sm leading-relaxed text-text-muted">{req.opts.message}</p>}
                {req.kind === "confirm" && req.opts.note && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-text-muted">{req.opts.note}</p>}
                {req.kind === "prompt" && (
                  <label className="mt-3 flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                    {req.opts.label}
                    <input
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={req.opts.placeholder}
                      className="h-10 rounded-[10px] border border-border bg-white px-3 text-sm font-normal text-text focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/15"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => finish(false)} className="inline-flex h-10 items-center rounded-[10px] border border-border bg-white px-4 text-sm font-semibold hover:bg-surface">
                {(req.kind === "confirm" && req.opts.cancelLabel) || "Cancel"}
              </button>
              <button type="submit" autoFocus={req.kind === "confirm"} className={`inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-semibold ${tone.button}`}>
                {req.opts.confirmLabel ?? (req.kind === "confirm" ? "Confirm" : "OK")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </DialogContext.Provider>
  );
}

export function useDialogs(): Api & {
  /** onSubmit handler for a <form>: asks first, then submits the form for real if confirmed. */
  confirmSubmit: (opts: ConfirmOptions) => (e: FormEvent<HTMLFormElement>) => void;
} {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialogs must be used inside <DialogProvider>");
  const confirmSubmit = (opts: ConfirmOptions) => (e: FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    if (form.dataset.confirmed === "1") {
      delete form.dataset.confirmed;
      return;
    }
    e.preventDefault();
    void ctx.confirm(opts).then((ok) => {
      if (!ok) return;
      form.dataset.confirmed = "1";
      form.requestSubmit();
    });
  };
  return { ...ctx, confirmSubmit };
}
