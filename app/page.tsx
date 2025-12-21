import { Suspense } from "react";
import PageInner from "./page-inner";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, fontFamily: "system-ui" }}>
          Loading…
        </div>
      }
    >
      <PageInner />
    </Suspense>
  );
}
