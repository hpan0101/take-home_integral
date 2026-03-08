import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redactIntakePii } from "@/lib/redact";
import { IntakeStatus } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const isPatient = role === "PATIENT";

  const intakes = await prisma.intake.findMany({
    where: isPatient ? { submittedById: session.user.id } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Reviewers see redacted PII in list
  const data = isPatient ? intakes : intakes.map(redactIntakePii);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "PATIENT") {
    return NextResponse.json(
      { error: "Only patients can submit enrollment applications" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const clientName = String(body.clientName ?? "").trim();
  const clientEmail = String(body.clientEmail ?? "").trim();
  const clientPhone = String(body.clientPhone ?? "").trim();
  const dateOfBirth = String(body.dateOfBirth ?? "").trim();
  const ssn = String(body.ssn ?? "").trim();
  const description = String(body.description ?? "").trim();
  const notes = body.notes != null ? String(body.notes).trim() : null;

  if (!clientName || !clientEmail || !clientPhone || !dateOfBirth || !ssn || !description) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: clientName, clientEmail, clientPhone, dateOfBirth, ssn, description",
      },
      { status: 400 }
    );
  }

  const intake = await prisma.intake.create({
    data: {
      clientName,
      clientEmail,
      clientPhone,
      dateOfBirth,
      ssn,
      description,
      notes: notes || undefined,
      status: IntakeStatus.PENDING,
      submittedById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATED",
      details: JSON.stringify({ status: intake.status }),
      userId: session.user.id,
      intakeId: intake.id,
    },
  });

  return NextResponse.json(intake, { status: 201 });
}
