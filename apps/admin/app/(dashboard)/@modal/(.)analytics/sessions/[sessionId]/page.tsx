import { getSessionJourney } from "@/app/(dashboard)/analytics/sessions/[sessionId]/getSessionJourney";
import { SessionJourneyContent } from "@/app/(dashboard)/analytics/sessions/[sessionId]/SessionJourneyContent";
import { SessionDrawer } from "./SessionDrawer";

export default async function SessionJourneyModal({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getSessionJourney(sessionId);

  return (
    <SessionDrawer>
      <SessionJourneyContent sessionId={sessionId} {...data} />
    </SessionDrawer>
  );
}
