"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./queue.module.css";

type IntakeStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";

type IntakeListItem = {
  id: string;
  status: IntakeStatus;
  clientName: string;
  createdAt: string;
  submittedBy?: { id: string; name: string; email: string };
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusClass(status: IntakeStatus): string {
  switch (status) {
    case "PENDING":
      return styles.statusPending;
    case "IN_REVIEW":
      return styles.statusInReview;
    case "APPROVED":
      return styles.statusApproved;
    case "REJECTED":
      return styles.statusRejected;
    default:
      return "";
  }
}

export default function QueuePage() {
  const [intakes, setIntakes] = useState<IntakeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/intakes", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Unauthorized" : `Request failed (${res.status})`);
        return res.json();
      })
      .then((data: IntakeListItem[]) => {
        if (!cancelled) {
          setIntakes(Array.isArray(data) ? data : []);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Failed to load intakes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Review Queue</h1>
        <p className={styles.subtitle}>
          Review and manage submitted enrollment applications. Click an application to view details.
        </p>

        {loading && <p className={styles.loading}>Loading intakes…</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && intakes.length === 0 && (
          <p className={styles.empty}>No applications in the queue.</p>
        )}

        {!loading && !error && intakes.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client name</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {intakes.map((intake) => (
                  <tr key={intake.id}>
                    <td>
                      <code style={{ fontSize: "0.85rem" }}>{intake.id.slice(0, 8)}…</code>
                    </td>
                    <td>{intake.clientName}</td>
                    <td>
                      <span className={`${styles.status} ${statusClass(intake.status)}`}>
                        {intake.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>{formatDate(intake.createdAt)}</td>
                    <td>
                      <Link href={`/queue/${intake.id}`} className={styles.link}>
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
