import { z } from "zod";

z.config(z.locales.ca());

function validSpanishDocument(type: string, raw: string) {
  const value = raw.toUpperCase().replace(/[\s-]/g, "");
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (type === "dni") {
    const match = value.match(/^(\d{8})([A-Z])$/);
    return !!match && letters[Number(match[1]) % 23] === match[2];
  }
  if (type === "nie") {
    const match = value.match(/^([XYZ])(\d{7})([A-Z])$/);
    if (!match) return false;
    const number = Number(({ X: "0", Y: "1", Z: "2" } as Record<string, string>)[match[1]] + match[2]);
    return letters[number % 23] === match[3];
  }
  return /^[A-Z0-9]{5,20}$/.test(value);
}

export const registrationSchema = z.object({
  eventId: z.string().uuid(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  documentType: z.enum(["dni", "nie", "passport"]),
  documentNumber: z.string().trim().min(5).max(25),
  documentCountry: z.string().trim().length(2).default("ES"),
  clubMember: z.literal(true),
  legalAccepted: z.literal(true),
}).superRefine((data, context) => {
  if (!validSpanishDocument(data.documentType, data.documentNumber)) {
    context.addIssue({ code: "custom", path: ["documentNumber"], message: "El document no té un format vàlid" });
  }
});

export const eventSchema = z.object({
  name: z.string().trim().min(3).max(100),
  startsAt: z.string().datetime(),
  registrationOpensAt: z.string().datetime(),
  registrationClosesAt: z.string().datetime(),
  prizeCount: z.number().int().min(1).max(40),
  prizeValueCents: z.number().int().min(100),
  venue: z.string().trim().max(180),
  clubSignupUrl: z.string().url(),
  termsUrl: z.string().url(),
  privacyUrl: z.string().url(),
  publicMessage: z.string().trim().max(240),
  status: z.enum(["draft", "scheduled", "registration_open", "registration_closed", "drawing", "completed"]),
});
