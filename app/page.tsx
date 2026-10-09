import { EventScreen } from "@/components/event-screen";
import { PublicDisplay } from "@/components/public-display";

export default function Home() {
  return <PublicDisplay><EventScreen displayMode /></PublicDisplay>;
}
