import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

/**
 * GET /api/intakes/[id]/documents/[docId]/file
 * Serve the file. Same access as GET intake (patient own only, reviewer any).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: intakeId, docId } = await params;

  const intake = await prisma.intake.findUnique({
    where: { id: intakeId },
    select: { submittedById: true },
  });
  if (!intake) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }

  const isPatient = session.user.role === "PATIENT";
  const isReviewer = session.user.role === "REVIEWER";
  if (isPatient && intake.submittedById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isPatient && !isReviewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: docId, intakeId },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const absolutePath = path.join(process.cwd(), doc.filePath);
  let buffer: Buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch {
    return NextResponse.json(
      { error: "File not found on server" },
      { status: 404 }
    );
  }

  const contentType = doc.fileType || "application/octet-stream";
  const disposition = `inline; filename="${encodeURIComponent(doc.fileName)}"`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Content-Length": String(buffer.length),
    },
  });
}
