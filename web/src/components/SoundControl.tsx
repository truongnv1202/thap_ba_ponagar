import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";

export default function SoundControl() {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(true);
  const [hint, setHint] = useState("");

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  const soundOff = muted || volume === 0;

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setMuted(true);
      setVolume(0);
      return;
    }
    try {
      let nextVol = volume;
      if (nextVol === 0) nextVol = 0.5;
      setVolume(nextVol);
      setMuted(false);
      audio.volume = nextVol;
      await audio.play();
      setPlaying(true);
      setHint("");
    } catch {
      setHint(t("musicHint"));
    }
  }

  return (
    <div className="flex w-fit items-center gap-2 rounded-full border border-amber-200/30 bg-black/30 px-2 py-1">
      <audio ref={audioRef} src="/audio/ponagar-theme.mp3" loop muted={muted} onEnded={() => setPlaying(false)} />
      <button
        type="button"
        title={soundOff && !playing ? t("playMusic") : t("pauseMusic")}
        onClick={togglePlay}
        className={`rounded-md px-2 py-1 text-xs font-semibold ${
          soundOff && !playing
            ? "border border-white/15 bg-white/10 text-amber-100/70"
            : "bg-amber-500 text-black hover:bg-amber-400"
        }`}
      >
        {soundOff && !playing ? "🔇" : "🔊"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => {
          const next = Number(e.target.value);
          setVolume(next);
          const a = audioRef.current;
          if (!a) return;
          a.volume = next;
          if (next === 0) {
            setMuted(true);
            if (playing) {
              a.pause();
              setPlaying(false);
            }
          } else {
            setMuted(false);
          }
        }}
        className="hidden w-20 md:block"
      />
      {hint && <p className="hidden text-[10px] text-amber-200 md:block">{t("musicHint")}</p>}
    </div>
  );
}
