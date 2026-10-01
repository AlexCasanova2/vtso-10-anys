export function ticketNumberCount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents < 6000) return 0;
  if (amountCents >= 10000) return 3;
  if (amountCents >= 8000) return 2;
  return 1;
}
