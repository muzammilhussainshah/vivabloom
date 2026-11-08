import type { Metadata } from "next";
import { AiSettingsForm } from "./AiSettingsForm";
import { getAiModelOverrides } from "@/lib/ai/overrides";

export const metadata: Metadata = { title: "AI Models" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const overrides = await getAiModelOverrides();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">AI Models</h1>
      <AiSettingsForm overrides={overrides} />
    </div>
  );
}
