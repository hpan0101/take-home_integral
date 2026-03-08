import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/intakes/[id]/audit
 * Returns audit log entries for an intake. Same access control as GET intake:
 * - Patient: only if they submitted the intake
 * - Reviewer: any intake
 * Sorted by most recent first.
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: intakeId } = await params;

  const intake = await prisma.intake.findUnique({
    where: { id: intakeId },
    select: { id: true, submittedById: true },
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

  const auditLogs = await prisma.auditLog.findMany({
    where: { intakeId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(auditLogs);
}
