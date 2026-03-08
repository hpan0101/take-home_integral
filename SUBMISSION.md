# Take-Home Submission Notes

*We value quality decision-making over feature completion.*

---

## Time spent

**Time spent:** ~4 hours

*(Adjust this to your actual start/stop time if different.)*

---

## What I prioritized and why

- **Auth first (NextAuth + credentials)** — Without login and role on the session, we can’t enforce patient vs reviewer flows or “patients see only their own data.” I used NextAuth with a credentials provider and bcrypt for passwords, with role (`PATIENT` / `REVIEWER`) and `id` on the session so every API can derive access from the server.

- **Intake APIs and redaction in the API layer** — I implemented GET/POST for intakes and GET/PATCH for a single intake, with redaction enforced on the server. Reviewers get redacted PII by default; full data is only returned when `view=privileged` is requested, and that privileged access is audited. This avoids clients bypassing masking via dev tools or direct API calls.

- **Core flow before polish** — I focused on the required path: enrollment form (all required fields + document upload), review queue list, detail page with redacted/privileged toggle, status updates (Pending → In Review → Approved/Rejected), and audit trail (CREATED, STATUS_CHANGED, VIEWED, ASSIGNED, document uploads). Middleware protects `/intake` (patient) and `/queue` (reviewer), and patients only see their own intakes.

- **Document upload** — Files are stored on disk and linked to the intake; the documents API supports listing and uploading, with audit entries for uploads. I kept the UX minimal (upload after intake creation, list on detail) to stay within the time box.

---

## What I would improve with more time

- **Tests** — Add unit tests for redaction helpers and API authorization (patient vs reviewer, own vs other intakes), and a few integration tests for the critical flows (submit intake, change status, view with privileged/redacted).

- **Queue filters and pagination** — Filter by status and date, and paginate the queue list for larger datasets.

- **Document preview** — In-browser preview for PDFs/images instead of download-only.

- **Error handling and validation** — Clearer API error responses and messages, and stricter validation (e.g. SSN format, phone) with helpful client-side feedback.

- **Accessibility and UX** — ARIA labels, keyboard navigation, and loading/empty states for the queue and detail views.

- **Security** — Rate limiting on login and intake creation, and ensuring uploads are scoped so users can’t access other intakes’ files.

---

## Loom recording

**Loom link:** https://www.loom.com/share/67dfcd0b6d79403dadcea06a53def6ea

*(A short walkthrough of the app is preferred.)*

---

## Submission checklist

- [x] Total time spent noted above
- [x] Priorities and rationale described
- [x] Improvements-with-more-time listed
- [x] Loom recording linked (or note if not provided)
- [x] Frequent commits pushed to your fork / zip shared
