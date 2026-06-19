import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <AuthForm mode="register" />
    </div>
  );
}