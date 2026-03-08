import styles from "./page.module.css";
import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  const role = session?.user ? (session.user as { role?: string }).role : null;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Intake Review System</h1>
          {session?.user ? (
            <p className={styles.userInfo}>
              Signed in as {session.user.email} ({role})
              {" · "}
              <Link href="/api/auth/signout" className={styles.linkInline}>
                Sign out
              </Link>
            </p>
          ) : (
            <p className={styles.userInfo}>
              <Link href="/login" className={styles.linkInline}>
                Sign in
              </Link>{" "}
              to submit an intake or access the review queue.
            </p>
          )}
        </header>
        <nav className={styles.nav}>
          {role !== "REVIEWER" && (
            <Link href="/intake" className={styles.link}>
              Submit Intake
            </Link>
          )}
          {role !== "PATIENT" && (
            <Link href="/queue" className={styles.link}>
              Review Queue
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
