import LoginForm from "./form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm registrationOpen={process.env.REGISTRATION_OPEN === "1"} />;
}
