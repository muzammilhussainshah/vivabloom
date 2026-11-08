"use client";

import { useActionState } from "react";
import {
  AI_TASKS,
  IMAGE_MODEL_OPTIONS,
  TEXT_MODEL_OPTIONS,
  codeDefaultModel,
} from "@/lib/ai/prompts";
import { updateAiModels, type ActionState } from "./actions";

export function AiSettingsForm({ overrides }: { overrides: Record<string, string> }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(updateAiModels, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <p className="text-sm text-text-muted">
        Pick which model runs each AI job. Each dropdown defaults to the value set in code
        (<code>apps/admin/lib/ai/prompts.ts</code>); choosing a different one saves an override, and
        setting it back to the default clears the override.
      </p>

      <div className="flex flex-col divide-y divide-border rounded-base border border-border">
        {AI_TASKS.map((task) => {
          const def = codeDefaultModel(task.key);
          const current = overrides[task.key] ?? def;
          const baseOptions = task.kind === "text" ? TEXT_MODEL_OPTIONS : IMAGE_MODEL_OPTIONS;
          // Guarantee the current value and the code default are always options.
          const options = Array.from(new Set([def, ...baseOptions, current]));

          return (
            <div key={task.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label htmlFor={`model_${task.key}`} className="text-sm font-medium">
                  {task.label}
                </label>
                <p className="text-xs text-text-muted">
                  <span className="uppercase tracking-wide">{task.kind}</span> · default:{" "}
                  <code>{def}</code>
                </p>
              </div>
              <select
                id={`model_${task.key}`}
                name={`model_${task.key}`}
                defaultValue={current}
                className="w-full rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none sm:w-64"
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                    {opt === def ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save AI Models"}
        </button>
        {state?.success && <p className="text-sm text-brand-accent">Saved.</p>}
        {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
      </div>
    </form>
  );
}
