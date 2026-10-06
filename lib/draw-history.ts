export type DrawAction = "extract" | "redraw" | "skip";
export type DrawLog = { action: string; payload: { number?: number; position?: number }; created_at: string };

export function resolveDrawHistory(logs: DrawLog[]) {
  const revealed = logs.filter((log) => log.action === "draw.number_revealed");
  return revealed.map((log, index) => {
    const number = log.payload.number!;
    const position = log.payload.position!;
    const absent = logs.some((row) => row.action === "draw.number_absent" && row.payload.number === number);
    const unawarded = logs.some((row) => row.action === "draw.prize_unawarded" && row.payload.position === position);
    return {
      number, position, revealed_at: log.created_at,
      attempt: revealed.slice(0, index + 1).filter((row) => row.payload.position === position).length,
      unawarded,
      status: absent || revealed[index + 1]?.payload.position === position ? "absent" as const : "awarded" as const,
    };
  });
}
