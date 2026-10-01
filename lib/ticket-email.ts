type TicketEmailContent = {
  firstName: string;
  numbers: number[];
  eventName: string;
  eventDate: string;
  venue: string;
  termsUrl: string;
  privacyUrl: string;
};

const colors = ["#00b1cd", "#ffed00", "#e75294"];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderTicketEmail({ firstName, numbers, eventName, eventDate, venue, termsUrl, privacyUrl }: TicketEmailContent) {
  if (!numbers.length) throw new Error("No hi ha números per enviar");

  const formatted = numbers.map((number) => String(number).padStart(3, "0"));
  const safeName = escapeHtml(firstName);
  const safeEvent = escapeHtml(eventName);
  const safeDate = escapeHtml(eventDate);
  const safeVenue = escapeHtml(venue);
  const rows: string[] = [];

  for (let start = 0; start < formatted.length; start += 3) {
    const group = formatted.slice(start, start + 3);
    rows.push(`<tr>${group.map((number, index) => `
      <td width="${Math.floor(100 / group.length)}%" valign="top" style="padding:5px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;">
          <tr><td align="center" bgcolor="${colors[(start + index) % colors.length]}" style="background-color:${colors[(start + index) % colors.length]};border-radius:12px;padding:16px 3px;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:${group.length === 1 ? 46 : 32}px;font-weight:800;line-height:1.2;letter-spacing:-1px;">${number}</td></tr>
        </table>
      </td>`).join("")}</tr>`);
  }

  const htmlContent = `<!doctype html>
<html lang="ca">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Els teus números de participació</title></head>
<body style="margin:0;padding:0;background-color:#f2f0eb;color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Els teus números per a ${safeEvent}: ${formatted.join(" · ")}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f2f0eb" style="border-collapse:collapse;background-color:#f2f0eb;">
    <tr><td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;max-width:600px;border-collapse:separate;background-color:#ffffff;">
        <tr><td height="7" bgcolor="#00b1cd" style="height:7px;background-color:#00b1cd;"></td></tr>
        <tr><td bgcolor="#111111" style="background-color:#111111;padding:25px 28px;color:#ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;line-height:1.35;letter-spacing:1px;color:#ffffff;">VILADECANS<br><span style="font-size:11px;font-weight:600;letter-spacing:2px;">THE STYLE OUTLETS</span></td>
            <td align="right" valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:1px;color:#ffed00;">10 ANYS</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 28px 28px;">
          <p style="margin:0 0 12px;color:#5a5a5a;font-size:14px;line-height:1.5;">Hola, ${safeName}.</p>
          <h1 style="margin:0 0 12px;font-size:30px;line-height:1.15;letter-spacing:-1px;font-weight:800;color:#111111;">Ja tens els teus números!</h1>
          <p style="margin:0 0 24px;color:#4b4b4b;font-size:15px;line-height:1.6;">${formatted.length === 1 ? "Aquest és el teu número de participació" : `Aquests són els teus ${formatted.length} números de participació`} per a <strong>${safeEvent}</strong>.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tbody>${rows.join("")}</tbody></table>
          <p style="margin:16px 0 0;color:#606060;font-size:12px;line-height:1.5;">Guarda aquest correu per consultar els teus números durant el sorteig.</p>
        </td></tr>
        <tr><td bgcolor="#f7f5ef" style="padding:27px 28px;background-color:#f7f5ef;border-top:1px solid #e9e6df;">
          <p style="margin:0 0 18px;color:#606060;font-size:11px;font-weight:800;letter-spacing:2px;">LA JORNADA</p>
          <p style="margin:0 0 14px;color:#111111;font-size:18px;font-weight:800;line-height:1.3;">${safeEvent}</p>
          <p style="margin:0 0 8px;color:#444444;font-size:14px;line-height:1.5;"><strong>Quan:</strong> ${safeDate}</p>
          <p style="margin:0;color:#444444;font-size:14px;line-height:1.5;"><strong>On:</strong> ${safeVenue}</p>
        </td></tr>
        <tr><td style="padding:24px 28px 30px;background-color:#ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#fce9f1" style="border-collapse:collapse;background-color:#fce9f1;"><tr><td style="padding:17px 19px;color:#111111;font-size:13px;line-height:1.55;">
            <strong style="display:block;margin-bottom:4px;font-size:11px;letter-spacing:1px;">IMPORTANT</strong>
            Si el teu número surt premiat, hauràs de ser-hi presencialment per recollir el premi.
          </td></tr></table>
        </td></tr>
      </table>
      <p style="max-width:600px;margin:20px 0 0;color:#696969;font-size:11px;line-height:1.6;">Aquest correu confirma la teva participació. <a href="${escapeHtml(termsUrl)}" style="color:#333333;text-decoration:underline;">Bases legals</a> · <a href="${escapeHtml(privacyUrl)}" style="color:#333333;text-decoration:underline;">Privacitat</a></p>
    </td></tr>
  </table>
</body></html>`;

  const textContent = `Hola, ${firstName}.\n\nEls teus números de participació per a ${eventName}: ${formatted.join(" · ")}\n\nSorteig: ${eventDate}\nLloc: ${venue}\n\nSi el teu número surt premiat, hauràs de ser-hi presencialment per recollir el premi.\n\nBases legals: ${termsUrl}\nPrivacitat: ${privacyUrl}`;

  return { htmlContent, textContent };
}
