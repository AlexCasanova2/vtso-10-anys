import { hashInvitationToken, invitationTokenPattern } from "@/lib/invitation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/types";
import { RegistrationCompletionForm } from "@/components/registration-completion-form";

export const dynamic = "force-dynamic";

export default async function RegistrationCompletionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const unavailable = <main className="register-shell register-loading"><div className="register-panel">
    <h1>Enllaç no disponible</h1><p>L&apos;enllaç ha caducat o ja s&apos;ha utilitzat. Demana al personal que te n&apos;enviï un altre abans que es tanqui la inscripció.</p>
  </div></main>;
  if (!invitationTokenPattern.test(token)) return unavailable;

  const { data: pending, error } = await createAdminClient().from("pending_ticket_registrations")
    .select("first_name,expires_at,completed_at,events(name,status,registration_closes_at,terms_url,privacy_url)")
    .eq("token_hash", hashInvitationToken(token)).maybeSingle();
  if (error || !pending || pending.completed_at) return unavailable;
  const event = pending.events as unknown as { name: string; status: string; registration_closes_at: string; terms_url: string; privacy_url: string };
  if (new Date(pending.expires_at) <= new Date() || new Date(event.registration_closes_at) <= new Date()
    || !["scheduled", "registration_open"].includes(event.status)) return unavailable;

  return <main className="register-shell"><meta name="referrer" content="no-referrer" />
    <div className="register-grid">
      <section className="register-intro"><p className="eyebrow">10 anys · Viladecans The Style Outlets</p>
        <h1>Completa la teva participació</h1><p>El personal ja ha comprovat el teu tiquet i la pertinença al Club. Encara no tens números assignats: completa les dades abans del {formatDateTime(pending.expires_at)}.</p>
        <p><strong>{event.name}</strong></p>
      </section>
      <RegistrationCompletionForm token={token} firstName={pending.first_name}
        termsUrl={event.terms_url} privacyUrl={event.privacy_url} />
    </div>
  </main>;
}
