import { RegistrationForm } from "@/components/registration-form";

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ jornada?: string }> }) {
  const { jornada } = await searchParams;
  return <RegistrationForm eventId={jornada} />;
}
