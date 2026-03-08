import Link from "next/link";
import { auth } from "@/auth";
import styles from "./AppHeader.module.css";

export default async function AppHeader() {
  const session = await auth();
  const role = session?.user ? (session.user as { role?: string }).role : null;

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.homeLink}>
        Intake Review System
      </Link>
      <div className={styles.userBar}>
        {session?.user ? (
          <>
            <span className={styles.userInfo}>
              Signed in as {session.user.email} ({role})
            </span>
            <span className={styles.sep}>·</span>
            <Link href="/api/auth/signout" className={styles.link}>
              Sign out
            </Link>
          </>
        ) : (
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
