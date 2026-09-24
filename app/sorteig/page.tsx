import { DrawScreen } from "@/components/draw-screen";
import "./sorteig.css";

export default async function DrawPage({ searchParams }: { searchParams: Promise<{ jornada?: string }> }) {
  const { jornada } = await searchParams;
  return <DrawScreen eventId={jornada} />;
}
