import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { InviteView } from "./invite-view";

export default function InvitePage({ params }: PageProps<"/i/[code]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      {params.then(({ code }) => (
        <InviteView code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
