import type { CSSProperties } from "react";
import { createCampaignConfetti } from "@/lib/campaign-confetti";

const particles = createCampaignConfetti();

export function CampaignConfetti() {
  return (
    <div className="campaign-confetti" aria-hidden="true">
      {particles.map((particle, index) => (
        <span className="confetti-particle" key={index} style={{
          left: `${particle.left}%`,
          "--fall-duration": `${particle.duration}s`,
          "--fall-delay": `${particle.delay}s`,
          "--drift": `${particle.drift}px`,
          "--size": `${particle.size}px`,
          "--color": particle.color,
          "--rotation": `${particle.rotation}deg`,
          "--flutter-duration": `${particle.flutter}s`,
        } as CSSProperties}><i /></span>
      ))}
    </div>
  );
}
