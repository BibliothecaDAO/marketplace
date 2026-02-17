import { OpsStatusPanel } from "@/features/ops/ops-status-panel";

export default function OpsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-start px-4 py-10 sm:px-8">
      <OpsStatusPanel />
    </main>
  );
}
