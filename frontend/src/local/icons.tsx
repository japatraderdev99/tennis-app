export function Icon({ name, size = 20 }: { name: "play" | "pause" | "plus" | "back" | "mark" | "repeat" | "volume" | "mute" | "expand" | "close" | "check"; size?: number }) {
  const paths = {
    play: "m8 5 11 7-11 7V5Z", pause: "M8 5v14M16 5v14", plus: "M12 5v14M5 12h14",
    back: "m14 6-6 6 6 6M8 12h13", mark: "M6 4h12v17l-6-4-6 4V4Z",
    repeat: "m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
    volume: "m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14",
    mute: "m11 5-6 4H2v6h3l6 4V5ZM16 9l6 6M22 9l-6 6", expand: "M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5",
    close: "m6 6 12 12M18 6 6 18", check: "m5 12 4 4 10-10",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
