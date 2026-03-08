import Link from "next/link";
import IntakeDetail from "@/components/IntakeDetail";

type Props = { params: Promise<{ id: string }> };

export default async function QueueDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <main style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/queue" style={{ color: "rgb(0, 112, 255)", textDecoration: "underline" }}>
          ← Back to queue
        </Link>
      </p>
      <IntakeDetail intakeId={id} privileged={false} />
    </main>
  );
}
