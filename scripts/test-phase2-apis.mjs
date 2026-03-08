/**
 * Phase 2 API tests (steps 3–6). Requires dev server running: npm run dev
 * Run: node scripts/test-phase2-apis.mjs
 */

const BASE = "http://localhost:3000";

/** Get all Set-Cookie header values (Node fetch may send multiple). */
function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const v = res.headers.get("set-cookie");
  if (!v) return [];
  return [v];
}

/** Simple cookie jar: merge new Set-Cookie values into existing cookie string. */
function mergeCookies(existing, setCookieValues) {
  if (!setCookieValues || setCookieValues.length === 0) return existing;
  const map = new Map();
  (existing || "").split(";").forEach((s) => {
    const i = s.indexOf("=");
    if (i > 0) map.set(s.slice(0, i).trim(), s.slice(i + 1).trim());
  });
  setCookieValues.forEach((raw) => {
    const part = raw.split(";")[0].trim();
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  });
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchWithCookies(url, options, cookieJar) {
  const headers = { ...options?.headers };
  if (cookieJar.cookie) headers.Cookie = cookieJar.cookie;
  const res = await fetch(url, { ...options, headers });
  const setCookies = getSetCookies(res);
  if (setCookies.length) cookieJar.cookie = mergeCookies(cookieJar.cookie, setCookies);
  return res;
}

async function login(role) {
  const jar = { cookie: "" };
  const csrfRes = await fetchWithCookies(`${BASE}/api/auth/csrf`, {}, jar);
  const { csrfToken } = await csrfRes.json();
  const email = role === "patient" ? "patient@demo.com" : "reviewer@demo.com";
  const password = "password";
  const body = new URLSearchParams({ email, password, csrfToken });
  const loginRes = await fetchWithCookies(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  }, jar);
  if (loginRes.status !== 302 && loginRes.status !== 200) {
    const text = await loginRes.text();
    throw new Error(`Login failed (${role}): ${loginRes.status} ${text.slice(0, 200)}`);
  }
  return jar;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log("Phase 2 API tests (3–6). Ensure dev server is running: npm run dev\n");

  let passed = 0;
  let failed = 0;

  // --- Test 3: POST /api/intakes (patient) ---
  console.log("--- Test 3: POST /api/intakes (patient) ---");
  try {
    const patientJar = await login("patient");

    const createBody = {
      clientName: "Test Patient",
      clientEmail: "test@example.com",
      clientPhone: "555-111-2222",
      dateOfBirth: "1990-01-15",
      ssn: "123-45-6789",
      description: "Phase 2 API test application",
      notes: "Optional notes",
    };

    const postRes = await fetchWithCookies(`${BASE}/api/intakes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    }, patientJar);
    assert(postRes.status === 201, `Expected 201, got ${postRes.status}`);
    const created = await postRes.json();
    assert(created.id, "Response should have id");
    assert(created.status === "PENDING", "Status should be PENDING");
    assert(created.submittedById, "Should have submittedById");
    console.log("  3.1 POST as patient -> 201, intake created");

    const listRes = await fetchWithCookies(`${BASE}/api/intakes`, {}, patientJar);
    assert(listRes.status === 200, `GET intakes: expected 200, got ${listRes.status}`);
    const list = await listRes.json();
    assert(Array.isArray(list), "GET intakes should return array");
    const found = list.find((i) => i.id === created.id);
    assert(found, "New intake should appear in GET /api/intakes");
    console.log("  3.2 GET /api/intakes as same patient -> new intake in list");

    const reviewerJar = await login("reviewer");
    const postAsReviewer = await fetchWithCookies(`${BASE}/api/intakes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    }, reviewerJar);
    assert(postAsReviewer.status === 403, `Expected 403 for reviewer POST, got ${postAsReviewer.status}`);
    const errBody = await postAsReviewer.json();
    assert(errBody.error && errBody.error.includes("patients"), "Error should mention only patients");
    console.log("  3.3 POST as reviewer -> 403");

    const badPost = await fetchWithCookies(`${BASE}/api/intakes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: "Only name", clientEmail: "e@e.com" }),
    }, patientJar);
    assert(badPost.status === 400, `Expected 400 for missing fields, got ${badPost.status}`);
    console.log("  3.4 POST with missing required fields -> 400");
    console.log("  Test 3 PASSED\n");
    passed++;
  } catch (e) {
    console.error("  FAIL:", e.message);
    failed++;
  }

  // --- Test 4: GET /api/intakes/[id] (patient vs reviewer, redaction) ---
  console.log("--- Test 4: GET /api/intakes/[id] (redaction) ---");
  try {
    const patientJar = await login("patient");
    const listRes = await fetchWithCookies(`${BASE}/api/intakes`, {}, patientJar);
    const list = await listRes.json();
    assert(list.length > 0, "Need at least one intake for patient");
    const intakeId = list[0].id;

    const getOwn = await fetchWithCookies(`${BASE}/api/intakes/${intakeId}`, {}, patientJar);
    assert(getOwn.status === 200, `GET own intake: expected 200, got ${getOwn.status}`);
    const own = await getOwn.json();
    assert(own.clientPhone && !own.clientPhone.startsWith("***"), "Patient should see full phone");
    assert(own.ssn && !own.ssn.startsWith("***"), "Patient should see full SSN");
    assert(own.auditLogs && Array.isArray(own.auditLogs), "Should include auditLogs");
    console.log("  4.1 Patient GET own intake -> 200, full PII");

    const reviewerJar = await login("reviewer");
    const allAsReviewer = await fetchWithCookies(`${BASE}/api/intakes`, {}, reviewerJar);
    const allList = await allAsReviewer.json();
    const otherId = allList.find((i) => i.id !== intakeId)?.id || allList[0].id;

    const getRedacted = await fetchWithCookies(`${BASE}/api/intakes/${otherId}`, {}, reviewerJar);
    assert(getRedacted.status === 200, `GET as reviewer: expected 200, got ${getRedacted.status}`);
    const redacted = await getRedacted.json();
    assert(redacted.clientPhone === "***-***-2222" || /^\*\*\*-\*\*\*-\d{4}$/.test(redacted.clientPhone), "Reviewer should see redacted phone");
    assert(redacted.dateOfBirth === "****-**-**", "Reviewer should see masked DOB");
    assert(redacted.ssn && /^\*\*\*-\*\*-\d{4}$/.test(redacted.ssn), "Reviewer should see redacted SSN");
    console.log("  4.2 Reviewer GET intake (no query) -> 200, redacted PII");

    const getPrivileged = await fetchWithCookies(`${BASE}/api/intakes/${otherId}?view=privileged`, {}, reviewerJar);
    assert(getPrivileged.status === 200, `GET privileged: expected 200, got ${getPrivileged.status}`);
    const privileged = await getPrivileged.json();
    assert(privileged.clientPhone && !privileged.clientPhone.startsWith("***"), "Privileged should have full phone");
    assert(privileged.ssn && !privileged.ssn.startsWith("***"), "Privileged should have full SSN");
    console.log("  4.3 Reviewer GET ?view=privileged -> 200, full PII");
    console.log("  Test 4 PASSED\n");
    passed++;
  } catch (e) {
    console.error("  FAIL:", e.message);
    failed++;
  }

  // --- Test 5: PATCH /api/intakes/[id] (reviewer only) ---
  console.log("--- Test 5: PATCH /api/intakes/[id] (reviewer) ---");
  try {
    const reviewerJar = await login("reviewer");
    const listRes = await fetchWithCookies(`${BASE}/api/intakes`, {}, reviewerJar);
    const list = await listRes.json();
    const intakeId = list[0].id;

    const patchRes = await fetchWithCookies(`${BASE}/api/intakes/${intakeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_REVIEW" }),
    }, reviewerJar);
    assert(patchRes.status === 200, `PATCH status: expected 200, got ${patchRes.status}`);
    const updated = await patchRes.json();
    assert(updated.status === "IN_REVIEW", "Status should be IN_REVIEW");
    assert(updated.clientPhone && /^\*\*\*-\*\*\*-\d{4}$/.test(updated.clientPhone), "Response should be redacted");
    console.log("  5.1 PATCH status -> 200, STATUS_CHANGED audited");

    const getAfter = await fetchWithCookies(`${BASE}/api/intakes/${intakeId}`, {}, reviewerJar);
    const after = await getAfter.json();
    const hasStatusChanged = after.auditLogs?.some((l) => l.action === "STATUS_CHANGED");
    assert(hasStatusChanged, "Audit should contain STATUS_CHANGED");
    console.log("  5.2 GET intake -> audit contains STATUS_CHANGED");

    const usersRes = await fetchWithCookies(`${BASE}/api/users`, {}, reviewerJar);
    const users = await usersRes.json();
    const reviewerUser = users.find((u) => u.role === "REVIEWER" && u.email === "reviewer@demo.com");
    assert(reviewerUser, "GET /api/users should return reviewer");
    const patchAssign = await fetchWithCookies(`${BASE}/api/intakes/${intakeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerId: reviewerUser.id }),
    }, reviewerJar);
    assert(patchAssign.status === 200, `PATCH assign: expected 200, got ${patchAssign.status}`);
    const assigned = await patchAssign.json();
    assert(assigned.reviewerId === reviewerUser.id, "reviewerId should be set");
    const getAfterAssign = await fetchWithCookies(`${BASE}/api/intakes/${intakeId}`, {}, reviewerJar);
    const afterAssign = await getAfterAssign.json();
    const hasAssigned = afterAssign.auditLogs?.some((l) => l.action === "ASSIGNED");
    assert(hasAssigned, "Audit should contain ASSIGNED");
    console.log("  5.3 PATCH reviewerId -> 200, ASSIGNED audited");

    const patientJar = await login("patient");
    const myList = await fetchWithCookies(`${BASE}/api/intakes`, {}, patientJar).then((r) => r.json());
    const myId = myList[0]?.id;
    if (myId) {
      const patchAsPatient = await fetchWithCookies(`${BASE}/api/intakes/${myId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      }, patientJar);
      assert(patchAsPatient.status === 403, `Patient PATCH: expected 403, got ${patchAsPatient.status}`);
      console.log("  5.4 PATCH as patient -> 403");
    }

    const invalidPatch = await fetchWithCookies(`${BASE}/api/intakes/${intakeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "INVALID" }),
    }, reviewerJar);
    assert(invalidPatch.status === 400, `Invalid status: expected 400, got ${invalidPatch.status}`);
    console.log("  5.5 PATCH with invalid status -> 400");
    console.log("  Test 5 PASSED\n");
    passed++;
  } catch (e) {
    console.error("  FAIL:", e.message);
    failed++;
  }

  // --- Test 6: GET /api/users ---
  console.log("--- Test 6: GET /api/users ---");
  try {
    const reviewerJar = await login("reviewer");
    const usersRes = await fetchWithCookies(`${BASE}/api/users`, {}, reviewerJar);
    assert(usersRes.status === 200, `GET users as reviewer: expected 200, got ${usersRes.status}`);
    const users = await usersRes.json();
    assert(Array.isArray(users), "Response should be array");
    assert(users.length >= 2, "Should have at least 2 users (patient, reviewer)");
    assert(users.every((u) => u.id && u.name && u.email && u.role), "Each user should have id, name, email, role");
    console.log("  6.1 Reviewer GET /api/users -> 200, array with id, name, email, role");

    const patientJar = await login("patient");
    const usersAsPatient = await fetchWithCookies(`${BASE}/api/users`, {}, patientJar);
    assert(usersAsPatient.status === 403, `GET users as patient: expected 403, got ${usersAsPatient.status}`);
    const err = await usersAsPatient.json();
    assert(err.error && err.error.includes("reviewers"), "Error should mention only reviewers");
    console.log("  6.2 Patient GET /api/users -> 403");
    console.log("  Test 6 PASSED\n");
    passed++;
  } catch (e) {
    console.error("  FAIL:", e.message);
    failed++;
  }

  console.log("--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
