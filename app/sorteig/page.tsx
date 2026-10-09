import { DrawScreen } from "@/components/draw-screen";
import { PublicDisplay } from "@/components/public-display";
import "./sorteig.css";

export default async function DrawPage({ searchParams }: { searchParams: Promise<{ jornada?: string }> }) {
  const { jornada } = await searchParams;
  return <PublicDisplay><DrawScreen eventId={jornada} /></PublicDisplay>;
}
