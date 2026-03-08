import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redactIntakePii } from "@/lib/redact";
import { IntakeStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES: IntakeStatus[] = [
  IntakeStatus.PENDING,
  IntakeStatus.IN_REVIEW,
  IntakeStatus.APPROVED,
  IntakeStatus.REJECTED,
];

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const privileged = searchParams.get("view") === "privileged";

  const intake = await prisma.intake.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!intake) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }

  const isPatient = session.user.role === "PATIENT";
  const isReviewer = session.user.role === "REVIEWER";

  if (isPatient) {
    if (intake.submittedById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Patients always get full data; log VIEWED
    await prisma.auditLog.create({
      data: {
        action: "VIEWED",
        details: JSON.stringify({ asOwner: true }),
        userId: session.user.id,
        intakeId: intake.id,
      },
    });
    return NextResponse.json(intake);
  }

  if (isReviewer) {
    if (privileged) {
      await prisma.auditLog.create({
        data: {
          action: "VIEWED_PRIVILEGED",
          details: JSON.stringify({ requestedPrivilegedView: true }),
          userId: session.user.id,
          intakeId: intake.id,
        },
      });
      return NextResponse.json(intake);
    }
    // Default: redacted view; log VIEWED (standard)
    await prisma.auditLog.create({
      data: {
        action: "VIEWED",
        details: null,
        userId: session.user.id,
        intakeId: intake.id,
      },
    });
    const redacted = redactIntakePii(intake);
    return NextResponse.json(redacted);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "REVIEWER") {
    return NextResponse.json(
      { error: "Only reviewers can update intake status or assignment" },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: { status?: string; reviewerId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const existing = await prisma.intake.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Intake not found" }, { status: 404 });
  }

  const updates: { status?: IntakeStatus; reviewerId?: string | null } = {};
  if (body.status !== undefined) {
    const s = body.status as string;
    if (!VALID_STATUSES.includes(s as IntakeStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    updates.status = s as IntakeStatus;
  }
  if (body.reviewerId !== undefined) {
    updates.reviewerId = body.reviewerId === "" ? null : body.reviewerId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid updates (status or reviewerId)" },
      { status: 400 }
    );
  }

  const intake = await prisma.intake.update({
    where: { id },
    data: updates,
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (updates.status !== undefined && updates.status !== existing.status) {
    await prisma.auditLog.create({
      data: {
        action: "STATUS_CHANGED",
        details: JSON.stringify({
          from: existing.status,
          to: updates.status,
        }),
        userId: session.user.id,
        intakeId: id,
      },
    });
  }
  if (
    updates.reviewerId !== undefined &&
    updates.reviewerId !== existing.reviewerId
  ) {
    await prisma.auditLog.create({
      data: {
        action: "ASSIGNED",
        details: JSON.stringify({
          reviewerId: updates.reviewerId,
        }),
        userId: session.user.id,
        intakeId: id,
      },
    });
  }

  // Return redacted by default for reviewer (PATCH response)
  const redacted = redactIntakePii(intake);
  return NextResponse.json(redacted);
}
