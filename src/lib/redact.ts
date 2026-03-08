/**
 * PII redaction helpers for reviewer view (default).
 * API uses these when returning intake data to reviewers unless view=privileged.
 */

/** SSN: show only last 4 digits, e.g. ***-**-6789 */
export function redactSsn(ssn: string | null | undefined): string {
  if (ssn == null || ssn === "") return "";
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "***-**-****";
  return `***-**-${digits.slice(-4)}`;
}

/** Phone: show only last 4 digits, e.g. ***-***-1234 */
export function redactPhone(phone: string | null | undefined): string {
  if (phone == null || phone === "") return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***-***-****";
  return `***-***-${digits.slice(-4)}`;
}

/** DOB: fully masked, e.g. ****-**-** */
export function redactDob(dob: string | null | undefined): string {
  if (dob == null || dob === "") return "";
  return "****-**-**";
}

export interface RedactableIntakeFields {
  clientPhone?: string | null;
  dateOfBirth?: string | null;
  ssn?: string | null;
}

/** Redact PII fields on an intake (or partial intake) for reviewer default view. */
export function redactIntakePii<T extends RedactableIntakeFields>(intake: T): T {
  return {
    ...intake,
    clientPhone: redactPhone(intake.clientPhone),
    dateOfBirth: redactDob(intake.dateOfBirth),
    ssn: redactSsn(intake.ssn),
  };
}
