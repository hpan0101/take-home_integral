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

type CreatedIntake = { id: string };

export default function IntakePage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdIntakeId, setCreatedIntakeId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

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

      const created = data as CreatedIntake;
      setSuccess("Enrollment application submitted successfully.");
      setForm(initialFormState);
      if (created?.id) setCreatedIntakeId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdIntakeId || !uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadDescription.trim()) formData.append("description", uploadDescription.trim());
      const res = await fetch(`/api/intakes/${createdIntakeId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? `Upload failed (${res.status})`);
        return;
      }
      setUploadSuccess(`"${uploadFile.name}" uploaded.`);
      setUploadFile(null);
      setUploadDescription("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
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
          <>
            <p className={styles.success} role="alert">
              {success}{" "}
              <Link href="/" className={styles.link}>
                Back to home
              </Link>
              {" or submit another below."}
            </p>
            {createdIntakeId && (
              <div className={styles.uploadSection}>
                <h2 className={styles.uploadTitle}>Upload supporting documents (optional)</h2>
                <p className={styles.uploadSubtitle}>
                  Medical records, insurance cards, prescriptions, etc. PDF, JPEG, PNG, GIF, WebP. Max 10 MB.
                </p>
                <form onSubmit={handleUpload} className={styles.uploadForm}>
                  <label className={styles.label}>
                    File
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      onChange={(e) => {
                        setUploadFile(e.target.files?.[0] ?? null);
                        setUploadError(null);
                      }}
                      className={styles.input}
                      disabled={uploading}
                    />
                  </label>
                  <label className={styles.label}>
                    Description (optional)
                    <input
                      type="text"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="e.g. Insurance card front"
                      className={styles.input}
                      disabled={uploading}
                    />
                  </label>
                  {uploadError && (
                    <p className={styles.error} role="alert">{uploadError}</p>
                  )}
                  {uploadSuccess && (
                    <p className={styles.success} role="status">{uploadSuccess}</p>
                  )}
                  <div className={styles.actions}>
                    <button
                      type="submit"
                      className={styles.submit}
                      disabled={uploading || !uploadFile}
                    >
                      {uploading ? "Uploading…" : "Upload document"}
                    </button>
                    <Link href="/" className={styles.secondary}>
                      Back to home
                    </Link>
                  </div>
                </form>
              </div>
            )}
          </>
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
