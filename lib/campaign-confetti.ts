const palette = ["#e75294", "#00b1cd", "#ffdc45", "#94c954", "#c72a89"];

export function createCampaignConfetti() {
  const count = 40;
  return Array.from({ length: count }, (_, index) => {
    const duration = 32 + (index * 7) % 19;
    const lane = (index * 37) % 100;
    const left = index % 4 === 0 ? 20 + lane * .6 : index % 2 === 0 ? 2 + lane * .16 : 82 + lane * .16;

    return {
      left,
      duration,
      delay: -duration * (((index * 13 + 7) % count) + .5) / count,
      drift: (index % 2 === 0 ? 1 : -1) * (8 + index % 17),
      size: 7 + index % 7,
      color: palette[index % palette.length],
      rotation: (index * 43) % 180,
      flutter: 7 + index % 5,
    };
  });
}
