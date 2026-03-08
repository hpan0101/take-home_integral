"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "@/app/queue/detail.module.css";
import AuditLog, { type AuditLogEntry } from "@/components/AuditLog";

interface IntakeDetailProps {
  intakeId: string;
}

interface UserRef {
  id: string;
  name: string | null;
  email: string | null;
}

interface DocumentRef {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
}

interface IntakeResponse {
  id: string;
  status: string;
  createdAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  dateOfBirth: string;
  ssn: string;
  description: string;
  notes: string | null;
  submittedBy: UserRef;
  reviewer: UserRef | null;
  auditLogs: AuditLogEntry[];
  documents?: DocumentRef[];
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: styles.statusPending,
  IN_REVIEW: styles.statusInReview,
  APPROVED: styles.statusApproved,
  REJECTED: styles.statusRejected,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function IntakeDetail({ intakeId }: IntakeDetailProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privilegedView, setPrivilegedView] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isReviewer = session?.user?.role === "REVIEWER";

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!session?.user?.id) {
      setLoading(false);
      setError("You must be signed in to view this intake.");
      return;
    }

    const viewParam = isReviewer && privilegedView ? "?view=privileged" : "";
    setLoading(true);
    setError(null);
    fetch(`/api/intakes/${intakeId}${viewParam}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error("You do not have access to this intake.");
          if (res.status === 404) throw new Error("Intake not found.");
          throw new Error(res.status === 401 ? "Please sign in again." : "Failed to load intake.");
        }
        return res.json();
      })
      .then((data: IntakeResponse) => {
        setIntake(data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [intakeId, session?.user?.id, sessionStatus, isReviewer, privilegedView, refreshTrigger]);

  if (sessionStatus === "loading" || loading) {
    return <p className={styles.loading}>Loading intake…</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!intake) {
    return null;
  }

  const statusClass = STATUS_CLASS[intake.status] ?? styles.statusPending;

  const STATUS_OPTIONS = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_REVIEW", label: "In review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ] as const;

  async function handleStatusChange(newStatus: string) {
    if (newStatus === intake.status || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/intakes/${intakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to update status.");
        return;
      }
      setError(null);
      setRefreshTrigger((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setStatusUpdating(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Intake Details</h2>
        <span className={`${styles.status} ${statusClass}`}>{intake.status.replace("_", " ")}</span>
      </div>

      {isReviewer && (
        <div className={styles.statusControl}>
          <label htmlFor="intake-status" className={styles.statusLabel}>
            Update status
          </label>
          <select
            id="intake-status"
            className={styles.statusSelect}
            value={intake.status}
            disabled={statusUpdating}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="Intake status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {statusUpdating && <span className={styles.statusUpdating}>Updating…</span>}
        </div>
      )}

      {isReviewer && (
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={privilegedView}
              onChange={(e) => setPrivilegedView(e.target.checked)}
              className={styles.checkbox}
            />
            Show full PII (privileged view)
          </label>
          <span className={styles.toggleHint}>
            {privilegedView ? "Full data visible; access is audited." : "PII is redacted by default."}
          </span>
        </div>
      )}

      <dl className={styles.dl}>
        <div className={styles.row}>
          <dt>Client name</dt>
          <dd>{intake.clientName}</dd>
        </div>
        <div className={styles.row}>
          <dt>Client email</dt>
          <dd>{intake.clientEmail}</dd>
        </div>
        <div className={styles.row}>
          <dt>Client phone</dt>
          <dd>{intake.clientPhone}</dd>
        </div>
        <div className={styles.row}>
          <dt>Date of birth</dt>
          <dd>{intake.dateOfBirth}</dd>
        </div>
        <div className={styles.row}>
          <dt>SSN</dt>
          <dd>{intake.ssn}</dd>
        </div>
        <div className={styles.row}>
          <dt>Description</dt>
          <dd className={styles.description}>{intake.description}</dd>
        </div>
        {intake.notes != null && intake.notes !== "" && (
          <div className={styles.row}>
            <dt>Notes</dt>
            <dd className={styles.description}>{intake.notes}</dd>
          </div>
        )}
        <div className={styles.row}>
          <dt>Submitted</dt>
          <dd>{formatDate(intake.createdAt)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Submitted by</dt>
          <dd>{intake.submittedBy?.name ?? intake.submittedBy?.email ?? "—"}</dd>
        </div>
        {intake.reviewer && (
          <div className={styles.row}>
            <dt>Assigned reviewer</dt>
            <dd>{intake.reviewer.name ?? intake.reviewer.email ?? "—"}</dd>
          </div>
        )}
      </dl>

      {intake.documents && intake.documents.length > 0 && (
        <section className={styles.auditSection}>
          <h3 className={styles.auditTitle}>Supporting documents</h3>
          <ul className={styles.auditList}>
            {intake.documents.map((doc) => (
              <li key={doc.id} className={styles.auditItem}>
                <a
                  href={`/api/intakes/${intakeId}/documents/${doc.id}/file`}
                  className={styles.docLink}
                  download={doc.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {doc.fileName}
                </a>
                <span className={styles.auditMeta}>
                  {(doc.fileSize / 1024).toFixed(1)} KB
                  {doc.description ? ` · ${doc.description}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AuditLog intakeId={intakeId} entries={intake.auditLogs} />
    </div>
  );
}
