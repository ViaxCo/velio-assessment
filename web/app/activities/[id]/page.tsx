import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { ActivityView } from "./activity-view";

export default function ActivityPage({ params }: PageProps<"/activities/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      {params.then(({ id }) => (
        <ActivityView id={id} />
      ))}
    </Suspense>
  );
}
