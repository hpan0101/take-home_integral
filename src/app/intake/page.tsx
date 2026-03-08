"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_TYPES = ".pdf,image/jpeg,image/png,image/gif,image/webp,application/pdf";

export default function IntakePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > maxBytes) {
        setError(`"${f.name}" is too large. Max ${MAX_FILE_SIZE_MB} MB per file.`);
        e.target.value = "";
        return;
      }
      valid.push(f);
    }
    setSelectedFiles((prev) => [...prev, ...valid]);
    setError(null);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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
    setUploadProgress(null);
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
      if (!created?.id) {
        setError("Invalid response from server.");
        return;
      }

      if (selectedFiles.length === 0) {
        setSuccess("Enrollment application submitted successfully.");
        setForm(initialFormState);
        setSubmitting(false);
        return;
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: selectedFiles.length });
        const formData = new FormData();
        formData.append("file", selectedFiles[i]);
        const uploadRes = await fetch(`/api/intakes/${created.id}/documents`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          setError(uploadData.error ?? `Upload failed for "${selectedFiles[i].name}" (${uploadRes.status}).`);
          setUploadProgress(null);
          setSubmitting(false);
          return;
        }
      }

      setSuccess(
        selectedFiles.length === 1
          ? "Application and 1 document submitted successfully."
          : `Application and ${selectedFiles.length} documents submitted successfully.`
      );
      setForm(initialFormState);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const submitLabel = uploadProgress
    ? `Uploading documents (${uploadProgress.current} of ${uploadProgress.total})…`
    : submitting
      ? "Submitting…"
      : "Submit application";

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Submit Intake</h1>
        <p className={styles.subtitle}>
          Submit a new enrollment application and optional supporting documents. All fields marked with * are required.
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

          <div className={styles.uploadSection}>
            <h2 className={styles.uploadTitle}>Supporting documents (optional)</h2>
            <p className={styles.uploadSubtitle}>
              Attach medical records, insurance cards, prescriptions, etc. PDF, JPEG, PNG, GIF, WebP. Max {MAX_FILE_SIZE_MB} MB per file.
            </p>
            <label className={styles.label}>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={handleFileChange}
                className={styles.input}
                disabled={submitting}
              />
            </label>
            {selectedFiles.length > 0 && (
              <ul className={styles.fileList}>
                {selectedFiles.map((file, i) => (
                  <li key={`${file.name}-${i}`} className={styles.fileItem}>
                    <span className={styles.fileName}>{file.name}</span>
                    <button
                      type="button"
                      className={styles.removeFile}
                      onClick={() => removeFile(i)}
                      disabled={submitting}
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitLabel}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => router.push("/")}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
