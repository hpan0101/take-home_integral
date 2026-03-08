import Link from "next/link";
import IntakeDetail from "@/components/IntakeDetail";
import styles from "../queue.module.css";

type Props = { params: Promise<{ id: string }> };

export default async function QueueDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className={styles.main}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/queue" className={styles.link}>
          ← Back to queue
        </Link>
      </p>
      <IntakeDetail intakeId={id} />
    </main>
  );
}
