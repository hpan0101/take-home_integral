import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UPLOAD_DIR = "uploads";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

function getIntakeAccess(
  intake: { submittedById: string } | null,
  session: { user: { id: string; role: string } }
) {
  if (!intake) return { allowed: false as const, status: 404 };
  const isPatient = session.user.role === "PATIENT";
  const isReviewer = session.user.role === "REVIEWER";
  if (isPatient && intake.submittedById !== session.user.id)
    return { allowed: false as const, status: 403 };
  if (isPatient || isReviewer) return { allowed: true as const };
  return { allowed: false as const, status: 403 };
}

/**
 * GET /api/intakes/[id]/documents
 * List documents for an intake. Same access as GET intake.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: intakeId } = await params;
  const intake = await prisma.intake.findUnique({
    where: { id: intakeId },
    select: { id: true, submittedById: true },
  });

  const { allowed, status } = getIntakeAccess(intake, session);
  if (!allowed) {
    if (status === 404)
      return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.document.findMany({
    where: { intakeId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
}

/**
 * POST /api/intakes/[id]/documents
 * Upload a file. Patients only, and only for intakes they submitted.
 * FormData: "file" (required), "description" (optional).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "PATIENT") {
    return NextResponse.json(
      { error: "Only patients can upload documents to their own applications" },
      { status: 403 }
    );
  }

  const { id: intakeId } = await params;
  const intake = await prisma.intake.findUnique({
    where: { id: intakeId },
    select: { id: true, submittedById: true },
  });

  if (!intake) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }
  if (intake.submittedById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "No file provided. Use form field 'file'." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 400 }
    );
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: `File type not allowed. Allowed: PDF, JPEG, PNG, GIF, WebP.`,
      },
      { status: 400 }
    );
  }

  const docId = randomUUID();
  const ext = path.extname(file.name) || "";
  const dir = path.join(process.cwd(), UPLOAD_DIR, intakeId);
  const relativePath = `${UPLOAD_DIR}/${intakeId}/${docId}${ext}`;
  const absolutePath = path.join(process.cwd(), relativePath);

  try {
    await mkdir(dir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absolutePath, new Uint8Array(bytes));
  } catch (err) {
    console.error("Document upload write error:", err);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }

  const description = formData.get("description");
  const descriptionStr =
    typeof description === "string" ? description.trim() || null : null;

  const doc = await prisma.document.create({
    data: {
      id: docId,
      intakeId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      filePath: relativePath,
      description: descriptionStr,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "DOCUMENT_UPLOADED",
      details: JSON.stringify({
        documentId: doc.id,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
      }),
      userId: session.user.id,
      intakeId,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
