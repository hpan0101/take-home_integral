"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "@/app/queue/detail.module.css";

interface IntakeDetailProps {
  intakeId: string;
}

interface UserRef {
  id: string;
  name: string | null;
  email: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: UserRef;
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
  }, [intakeId, session?.user?.id, sessionStatus, isReviewer, privilegedView]);

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

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Intake Details</h2>
        <span className={`${styles.status} ${statusClass}`}>{intake.status.replace("_", " ")}</span>
      </div>

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

      {intake.auditLogs && intake.auditLogs.length > 0 && (
        <section className={styles.auditSection}>
          <h3 className={styles.auditTitle}>Audit trail</h3>
          <ul className={styles.auditList}>
            {intake.auditLogs.map((log) => (
              <li key={log.id} className={styles.auditItem}>
                <span className={styles.auditAction}>{log.action}</span>
                <span className={styles.auditMeta}>
                  {log.user?.name ?? log.user?.email ?? "Unknown"} · {formatDate(log.createdAt)}
                </span>
                {log.details && (
                  <span className={styles.auditDetails}>{log.details}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
