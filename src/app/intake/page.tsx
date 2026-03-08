"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./intake.module.css";

const REQUIRED_FIELDS = [
  "clientName",
  "clientEmail",
  "clientPhone",
  "dateOfBirth",
  "ssn",
  "description",
] as const;

type FormState = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  dateOfBirth: string;
  ssn: string;
  description: string;
  notes: string;
};

const initialFormState: FormState = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  dateOfBirth: "",
  ssn: "",
  description: "",
  notes: "",
};

export default function IntakePage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const missing = REQUIRED_FIELDS.filter((f) => !String(form[f] ?? "").trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail.trim(),
          clientPhone: form.clientPhone.trim(),
          dateOfBirth: form.dateOfBirth.trim(),
          ssn: form.ssn.trim(),
          description: form.description.trim(),
          notes: form.notes.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      setSuccess("Enrollment application submitted successfully.");
      setForm(initialFormState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Submit Intake</h1>
        <p className={styles.subtitle}>
          Submit a new enrollment application. All fields marked with * are required.
        </p>

        {success && (
          <p className={styles.success} role="alert">
            {success}{" "}
            <Link href="/" className={styles.link}>
              Back to home
            </Link>
            {" or submit another below."}
          </p>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            Client name *
            <input
              type="text"
              value={form.clientName}
              onChange={update("clientName")}
              placeholder="Full name"
              className={styles.input}
              disabled={submitting}
            />
          </label>

          <label className={styles.label}>
            Client email *
            <input
              type="email"
              value={form.clientEmail}
              onChange={update("clientEmail")}
              placeholder="email@example.com"
              className={styles.input}
              disabled={submitting}
            />
          </label>

          <label className={styles.label}>
            Client phone *
            <input
              type="tel"
              value={form.clientPhone}
              onChange={update("clientPhone")}
              placeholder="e.g. 555-123-4567"
              className={styles.input}
              disabled={submitting}
            />
          </label>

          <label className={styles.label}>
            Date of birth *
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={update("dateOfBirth")}
              className={styles.input}
              disabled={submitting}
            />
          </label>

          <label className={styles.label}>
            SSN *
            <input
              type="text"
              value={form.ssn}
              onChange={update("ssn")}
              placeholder="XXX-XX-XXXX"
              className={styles.input}
              disabled={submitting}
              autoComplete="off"
            />
          </label>

          <label className={styles.label}>
            Description *
            <textarea
              value={form.description}
              onChange={update("description")}
              placeholder="Reason for enrollment, medical history, etc."
              className={styles.textarea}
              rows={4}
              disabled={submitting}
            />
          </label>

          <label className={styles.label}>
            Notes (optional)
            <textarea
              value={form.notes}
              onChange={update("notes")}
              placeholder="Additional notes"
              className={styles.textarea}
              rows={2}
              disabled={submitting}
            />
          </label>

          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </button>
            <Link href="/" className={styles.secondary}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
