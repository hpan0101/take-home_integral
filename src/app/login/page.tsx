import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string }).role;
    if (role === "REVIEWER") redirect("/queue");
    if (role === "PATIENT") redirect("/intake");
    redirect("/");
  }

  const params = await searchParams;
  const hasError = params.error != null;

  return (
    <main className="login-main">
      <div className="login-card">
        <h1>Sign in</h1>
        <p className="login-subtitle">
          Use your demo account to access the intake or review queue.
        </p>
        {hasError && (
          <p className="login-error" role="alert" style={{ marginBottom: "0.75rem" }}>
            Invalid email or password. Please try again.
          </p>
        )}
        <LoginForm />
        <p className="login-hint">
          Demo: patient@demo.com / reviewer@demo.com — password: <strong>password</strong>
        </p>
      </div>
    </main>
  );
}
