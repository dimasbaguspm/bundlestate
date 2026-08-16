import { CheckCircle2, Loader2, OctagonX, XCircle } from "lucide-react";
import { clsx } from "clsx";
import type { Job } from "@/state/store";
import { abortJob } from "@/state/runJob";
import { Badge, Button, Card } from "./ui";

const statusLabel: Record<Job["status"], string> = {
  pending: "Queued",
  extracting: "Extracting zip",
  normalizing: "Analyzing",
  done: "Done",
  error: "Failed",
  aborted: "Aborted",
};

function StatusIcon({ status }: { status: Job["status"] }) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={16} className="text-ok" aria-hidden />;
    case "error":
      return <XCircle size={16} className="text-danger" aria-hidden />;
    case "aborted":
      return <OctagonX size={16} className="text-muted" aria-hidden />;
    default:
      return <Loader2 size={16} className="animate-spin text-ink" aria-hidden />;
  }
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-200"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function JobsPanel({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null;
  const active = jobs.filter(
    (j) => j.status === "extracting" || j.status === "normalizing" || j.status === "pending",
  );

  return (
    <section className="space-y-2" aria-label="Parse jobs">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className={clsx("flex items-center gap-4", job.status === "error" && "border-danger/40")}
        >
          <StatusIcon status={job.status} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-mono text-sm">{job.sourceName}</p>
              <Badge
                tone={job.status === "error" ? "danger" : job.status === "done" ? "ok" : "accent"}
              >
                {statusLabel[job.status]}
              </Badge>
            </div>
            {job.error && <p className="text-sm text-danger">{job.error}</p>}
            {job.status !== "done" && job.status !== "error" && job.status !== "aborted" && (
              <ProgressBar value={job.progress} />
            )}
          </div>
          {(job.status === "extracting" ||
            job.status === "normalizing" ||
            job.status === "pending") && (
            <Button variant="ghost" onClick={() => abortJob(job.id)}>
              Abort
            </Button>
          )}
        </Card>
      ))}
      {active.length > 0 && (
        <p className="text-xs text-muted">
          {active.length} active job{active.length === 1 ? "" : "s"} — running in Web Workers,
          on-device
        </p>
      )}
    </section>
  );
}
