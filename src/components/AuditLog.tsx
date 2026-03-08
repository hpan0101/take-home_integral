"use client";

import { useEffect, useState } from "react";
import styles from "@/app/queue/detail.module.css";

export interface AuditLogEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface AuditLogProps {
  intakeId: string;
  /** When provided, audit entries are used directly (no fetch). Sorted by most recent first. */
  entries?: AuditLogEntry[] | null;
}

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

/** Format details JSON for display (e.g. STATUS_CHANGED from/to, ASSIGNED reviewerId). */
function formatDetails(details: string | null): string | null {
  if (details == null || details === "") return null;
  try {
    const obj = JSON.parse(details) as Record<string, unknown>;
    if (obj.from != null && obj.to != null) {
      return `From ${String(obj.from)} to ${String(obj.to)}`;
    }
    if (obj.reviewerId != null) {
      return `Assigned to ${String(obj.reviewerId)}`;
    }
    if (obj.asOwner === true) {
      return "Viewed as applicant";
    }
    if (obj.requestedPrivilegedView === true) {
      return "Privileged (full PII) view";
    }
    if (obj.fileName != null) {
      const size = obj.fileSize != null ? ` (${Number(obj.fileSize)} bytes)` : "";
      return `Uploaded: ${String(obj.fileName)}${size}`;
    }
    return details;
  } catch {
    return details;
  }
}

function sortByNewestFirst(logs: AuditLogEntry[]): AuditLogEntry[] {
  return [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default function AuditLog({ intakeId, entries: entriesProp }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(
    entriesProp !== undefined ? (entriesProp ?? []) : null
  );
  const [loading, setLoading] = useState(entriesProp === undefined);
  const [error, setError] = useState<string | null>(null);

  const isControlled = entriesProp !== undefined;

  useEffect(() => {
    if (isControlled) {
      setEntries(entriesProp ?? []);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/intakes/${intakeId}/audit`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error("You do not have access to this intake.");
          if (res.status === 404) throw new Error("Intake not found.");
          throw new Error(res.status === 401 ? "Please sign in again." : "Failed to load audit log.");
        }
        return res.json();
      })
      .then((data: AuditLogEntry[]) => setEntries(data))
      .catch((err: Error) => {
        setError(err.message);
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [intakeId, isControlled, entriesProp]);

  if (loading) {
    return (
      <section className={styles.auditSection}>
        <h3 className={styles.auditTitle}>Audit trail</h3>
        <p className={styles.loading}>Loading audit log…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.auditSection}>
        <h3 className={styles.auditTitle}>Audit trail</h3>
        <p className={styles.error}>{error}</p>
      </section>
    );
  }

  const sorted = entries && entries.length > 0 ? sortByNewestFirst(entries) : [];

  return (
    <section className={styles.auditSection}>
      <h3 className={styles.auditTitle}>Audit trail</h3>
      {sorted.length === 0 ? (
        <p className={styles.auditMeta}>No audit entries yet.</p>
      ) : (
        <ul className={styles.auditList}>
          {sorted.map((log) => {
            const detailsText = formatDetails(log.details);
            return (
              <li key={log.id} className={styles.auditItem}>
                <span className={styles.auditAction}>{log.action.replace(/_/g, " ")}</span>
                <span className={styles.auditMeta}>
                  {log.user?.name ?? log.user?.email ?? "Unknown"} · {formatDate(log.createdAt)}
                </span>
                {detailsText && (
                  <span className={styles.auditDetails}>{detailsText}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
