type InvitationEmail = { firstName: string; eventName: string; url: string; expiresAt: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderInvitationEmail({ firstName, eventName, url, expiresAt }: InvitationEmail) {
  const safeUrl = escapeHtml(url);
  return {
    subject: `Completa la teva participació a ${eventName}`,
    text: `Hola, ${firstName}.\n\nEl personal ha validat el teu tiquet per a ${eventName}. Encara no participes en el sorteig: completa les teves dades i accepta les bases abans del ${expiresAt} per rebre els teus números.\n\n${url}\n\nAquest enllaç és personal i només es pot fer servir una vegada. Si no has sol·licitat participar-hi, ignora aquest missatge.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111;line-height:1.6"><h1>Completa la teva participació</h1><p>Hola, ${escapeHtml(firstName)}.</p><p>El personal ha validat el teu tiquet per a <strong>${escapeHtml(eventName)}</strong>. Encara no participes en el sorteig: completa les teves dades i accepta les bases abans del ${escapeHtml(expiresAt)} per rebre els teus números.</p><p><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;background:#ffed00;color:#111;font-weight:bold;text-decoration:none">Completa la participació</a></p><p>Aquest enllaç és personal i només es pot fer servir una vegada. Si no has sol·licitat participar-hi, ignora aquest missatge.</p></div>`,
  };
}
