"use client";

/**
 * RoulettePicker — INNOVATHON "Ruleta de Pitches"
 * --------------------------------------------------------------------------
 * Full-screen team randomizer matched to the INNOVATHON BIOS/terminal theme.
 *  - Two spin styles: TERMINAL (single scramble readout) and REEL (slot reel).
 *  - Decelerating spin with synthesized slot-machine ticks + lock-in chime (WebAudio).
 *  - Elimination: picked teams leave the pool; round auto-resets when all have gone.
 *  - Matrix-rain canvas backdrop.
 *
 * Drop-in: replace app/page.tsx body with <RoulettePicker /> (it owns the full screen),
 * or render it inside any client route. See README.md for fonts + globals.css setup.
 *
 * Fonts expected (CSS variables, see README):
 *   --font-geist-mono  → UI / labels (monospace)
 *   --font-chakra      → big display readouts (Chakra Petch)
 * Falls back to system monospace / sans if the variables are absent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---- theme tokens ---------------------------------------------------------
const GREEN = "#33E03A";
const GREEN_HI = "#52f05a";
const BG = "#070907";
const INK = "#EAEFEA";
const MONO = "var(--font-geist-mono, 'Geist Mono', 'JetBrains Mono', monospace)";
const DISPLAY = "var(--font-chakra, 'Chakra Petch', sans-serif)";

const SEED_TEAMS = [
  "Neuro Link",
  "Your Hack",
  "Furritos Picositos",
  "Pepe's",
  "Banda el Recommit",
  "Los Six Severos",
  "Los Amigos Macizos",
  "Grupo Menudo",
  "Quadratech",
  "Syntropyc",
  "Gangbangers",
  "Predicadores de la IA",
  "Next Station",
  "UvoxData",
  "Los BeKa3",
  "Vibe Coding Brotherhood",
  "Sudo",
  "PugDebug",
  "πt",
  "Innova Dreamers",
  "Authropic",
  "Chispas Team",
  "QuatumChihuahua",
];

const TEAM_LINKS: Record<string, string> = {
  "Neuro Link": "https://summit-ocean-497.faces.site/40ezg537bo7l",
  "Your Hack": "https://jackal-elm-282.faces.site/r5o3i1yjk09b",
  "Furritos Picositos": "https://diamond-onyx-297.faces.site/rxcbuzgygk6t",
  "Pepe's": "https://hawk-tiger-685.faces.site/wugfdzfl2c6v",
  "Banda el Recommit": "https://cheetah-forest-648.faces.site/xfou18v7xtph",
  "Los Six Severos": "https://opal-lion-491.faces.site/l9gaxlp78rcg",
  "Los Amigos Macizos": "https://volcano-raven-602.faces.site/8m0zrl23y4gp",
  "Grupo Menudo": "https://ridge-forest-679.faces.site/qzir5uj9npzu#face-7q2lmz",
  "Quadratech": "https://spring-spruce-307.faces.site/wivgmiq4c5qj",
  "Syntropyc": "https://owl-fox-955.faces.site/mep3pso0a21u",
  "Gangbangers": "https://leopard-lake-815.faces.site/21bdz0yzqxnu",
  "Predicadores de la IA": "https://faces.app/predicadores-de-la-ia",
  "Next Station": "https://faces.app/next-station",
  "UvoxData": "https://canva.link/2q4loj2l2xahfnd",
  "Los BeKa3": "https://faces.app/los-beka3",
  "Vibe Coding Brotherhood": "https://faces.app/vibe-coding-brotherhood",
  "Sudo": "https://koala-reef-63.faces.site/sb2vt64s35iw",
  "PugDebug": "https://summit-glacier-576.faces.site/0ufcz7d4a45w",
  "πt": "https://aquamarine-dune-246.faces.site/gmyyive4ekqd",
  "Innova Dreamers": "https://glacier-falcon-983.faces.site/bct19fuvgugh",
  "Authropic": "https://ruby-coast-369.faces.site/703zok05112x",
  "Chispas Team": "https://hyena-finch-968.faces.site/p516tmfw4mr0",
  "QuatumChihuahua": "https://jade-redwood-4.faces.site/l0sct5nl37tg",
};

type Mode = "terminal" | "reel";
const pad = (n: number) => String(n).padStart(2, "0");

export default function RoulettePicker() {
  const [teams, setTeams] = useState<string[]>(SEED_TEAMS);
  const [used, setUsed] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("terminal");
  const [soundOn, setSoundOn] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState("—");
  const [ghosts, setGhosts] = useState<string[]>(["—", "—", "—", "—"]);
  const [winner, setWinner] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  const available = useMemo(
    () => teams.filter((t) => !used.includes(t)),
    [teams, used]
  );

  // ---- audio --------------------------------------------------------------
  const actx = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const ensureAudio = useCallback(() => {
    if (!actx.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) actx.current = new AC();
    }
    if (actx.current && actx.current.state === "suspended") actx.current.resume();
  }, []);

  const blip = useCallback(
    (freq: number, dur: number, type: OscillatorType, gain: number) => {
      const a = actx.current;
      if (!a || !soundRef.current) return;
      const t = a.currentTime;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + dur);
    },
    []
  );

  const tickSound = useCallback(
    () => blip(620 + Math.random() * 160, 0.035, "square", 0.1),
    [blip]
  );
  const lockSound = useCallback(() => {
    blip(523, 0.12, "triangle", 0.22);
    setTimeout(() => blip(784, 0.14, "triangle", 0.22), 90);
    setTimeout(() => blip(1046, 0.3, "triangle", 0.22), 190);
  }, [blip]);

  // ---- roster -------------------------------------------------------------
  const addTeam = useCallback(() => {
    const v = input.trim();
    if (!v || teams.includes(v)) {
      setInput("");
      return;
    }
    setTeams((p) => [...p, v]);
    setInput("");
  }, [input, teams]);

  const removeTeam = useCallback((name: string) => {
    setTeams((p) => p.filter((t) => t !== name));
    setUsed((p) => p.filter((t) => t !== name));
  }, []);

  const resetRound = useCallback(() => {
    if (spinning) return;
    setUsed([]);
    setDisplay("—");
    setGhosts(["—", "—", "—", "—"]);
    setWinner(null);
    setAllDone(false);
  }, [spinning]);

  // ---- spin ---------------------------------------------------------------
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(
    (w: string) => {
      setUsed((prev) => {
        const next = prev.includes(w) ? prev : [...prev, w];
        setAllDone(next.length >= teams.length);
        return next;
      });
      setDisplay(w);
      setWinner(w);
      setSpinning(false);
      lockSound();
    },
    [teams.length, lockSound]
  );

  const onSpin = useCallback(() => {
    if (spinning) return;
    ensureAudio();
    const pool = available;
    if (pool.length === 0) return;
    if (pool.length === 1) {
      finish(pool[0]);
      return;
    }
    const w = pool[Math.floor(Math.random() * pool.length)];
    const steps = 26 + Math.floor(Math.random() * 8);
    setSpinning(true);
    setWinner(null);
    let step = 0;
    const rand = () => pool[Math.floor(Math.random() * pool.length)];
    const tick = () => {
      if (step >= steps) {
        setDisplay(w);
        setGhosts([rand(), rand(), rand(), rand()]);
        finish(w);
        return;
      }
      setDisplay(rand());
      setGhosts([rand(), rand(), rand(), rand()]);
      tickSound();
      step++;
      const t = step / steps;
      const delay = 45 + 200 * Math.pow(t, 2.6);
      timer.current = setTimeout(tick, delay);
    };
    tick();
  }, [spinning, available, ensureAudio, finish, tickSound]);

  const closeWinner = useCallback(() => {
    if (allDone) setUsed([]);
    setWinner(null);
    setAllDone(false);
  }, [allDone]);

  // ---- matrix canvas ------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let mounted = true;
    let raf = 0;
    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const chars = "01<>/{}[]=+*¦#ABCDEF$アイウエカキ".split("");
    const fs = 16;
    const drops: number[] = [];
    let last = 0;
    const draw = (ts: number) => {
      if (!mounted) return;
      if (ts - last > 75) {
        last = ts;
        const cols = Math.floor(c.width / fs);
        while (drops.length < cols) drops.push(Math.random() * -60);
        ctx.fillStyle = "rgba(7,9,7,0.12)";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "rgba(51,224,58,0.6)";
        ctx.font = `${fs}px monospace`;
        for (let i = 0; i < cols; i++) {
          const ch = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(ch, i * fs, drops[i] * fs);
          if (drops[i] * fs > c.height && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // ---- derived ------------------------------------------------------------
  const total = teams.length;
  const usedCount = used.length;
  const statusText = spinning
    ? "// SELECCIONANDO_EQUIPO..."
    : winner
    ? "// EQUIPO_BLOQUEADO"
    : available.length === 0 && total > 0
    ? "// RONDA_COMPLETA"
    : "// LISTO_PARA_GIRAR";
  const progressW = total ? `${(usedCount / total) * 100}%` : "0%";

  // ---- styles -------------------------------------------------------------
  const tab = (active: boolean): React.CSSProperties => ({
    background: active ? GREEN : "transparent",
    color: active ? "#04140a" : "rgba(180,210,180,0.7)",
    border: "none",
    fontFamily: MONO,
    fontWeight: active ? 600 : 400,
    fontSize: 11,
    letterSpacing: "0.16em",
    padding: "9px 16px",
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: BG,
        fontFamily: MONO,
        color: INK,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          opacity: 0.38,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(rgba(51,224,58,0.025) 1px, transparent 1px)",
          backgroundSize: "100% 3px",
          mixBlendMode: "screen",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            padding: "16px clamp(20px,3vw,40px)",
            borderBottom: "1px solid rgba(51,224,58,0.18)",
            background: "rgba(7,9,7,0.55)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.18em",
              }}
            >
              INNOVATHON <span style={{ color: GREEN }}>2026</span>
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.32em",
                color: "rgba(150,180,150,0.5)",
              }}
            >
              RULETA DE PITCHES · BY INNOVA
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", border: "1px solid rgba(51,224,58,0.35)" }}>
              <button onClick={() => setMode("terminal")} style={tab(mode === "terminal")}>
                TERMINAL
              </button>
              <button onClick={() => setMode("reel")} style={tab(mode === "reel")}>
                REEL
              </button>
            </div>
            <button
              onClick={() => setSoundOn((s) => !s)}
              style={{
                background: "transparent",
                border: "1px solid rgba(51,224,58,0.35)",
                color: "rgba(180,210,180,0.85)",
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.14em",
                padding: "9px 14px",
                cursor: "pointer",
              }}
            >
              {soundOn ? "[ SONIDO: ON ]" : "[ SONIDO: OFF ]"}
            </button>
          </div>
        </header>

        {/* BODY */}
        <div style={{ flex: "1 1 auto", display: "flex", minHeight: 0 }}>
          {/* SIDEBAR */}
          <aside
            style={{
              flex: "0 0 clamp(280px,24vw,380px)",
              borderRight: "1px solid rgba(51,224,58,0.18)",
              background: "rgba(7,10,7,0.6)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: "20px clamp(16px,1.4vw,22px) 14px",
                borderBottom: "1px solid rgba(51,224,58,0.12)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  color: "rgba(140,200,150,0.6)",
                  marginBottom: 14,
                }}
              >
                // EQUIPOS_REGISTRADOS
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTeam()}
                  placeholder="Nombre del equipo"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "rgba(51,224,58,0.05)",
                    border: "1px solid rgba(51,224,58,0.28)",
                    color: INK,
                    fontFamily: MONO,
                    fontSize: 13,
                    letterSpacing: "0.02em",
                    padding: "11px 12px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={addTeam}
                  style={{
                    flex: "0 0 auto",
                    background: GREEN,
                    color: "#04140a",
                    border: "none",
                    fontFamily: DISPLAY,
                    fontWeight: 700,
                    fontSize: 18,
                    lineHeight: 1,
                    width: 44,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "6px 0" }}>
              {teams.map((name, i) => {
                const isUsed = used.includes(name);
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px clamp(16px,1.4vw,22px)",
                      borderBottom: "1px solid rgba(51,224,58,0.06)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(120,160,120,0.45)",
                        width: 20,
                        flex: "0 0 auto",
                      }}
                    >
                      {pad(i + 1)}
                    </span>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        flex: "0 0 auto",
                        background: isUsed ? "rgba(120,150,120,0.35)" : GREEN,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13.5,
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: isUsed ? "rgba(140,170,140,0.4)" : "#d6efd6",
                        textDecoration: isUsed ? "line-through" : "none",
                      }}
                    >
                      {name}
                    </span>
                    <button
                      onClick={() => removeTeam(name)}
                      style={{
                        flex: "0 0 auto",
                        background: "transparent",
                        border: "none",
                        color: "rgba(160,180,160,0.4)",
                        fontFamily: MONO,
                        fontSize: 15,
                        cursor: "pointer",
                        padding: "0 4px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {total === 0 && (
                <div
                  style={{
                    padding: "24px 22px",
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: "rgba(140,170,140,0.4)",
                    letterSpacing: "0.04em",
                  }}
                >
                  &gt; No hay equipos.
                  <br />
                  Agrega los nombres arriba para comenzar.
                </div>
              )}
            </div>

            <div
              style={{
                flex: "0 0 auto",
                padding: "16px clamp(16px,1.4vw,22px) 18px",
                borderTop: "1px solid rgba(51,224,58,0.14)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                <span style={{ color: "rgba(140,200,150,0.6)" }}>PRESENTADOS</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600 }}>
                  {pad(usedCount)} / {pad(total)}
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  background: "rgba(51,224,58,0.12)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: GREEN,
                    width: progressW,
                    transition: "width .4s ease",
                  }}
                />
              </div>
              <button
                onClick={resetRound}
                style={{
                  marginTop: 14,
                  width: "100%",
                  background: "transparent",
                  border: "1px solid rgba(51,224,58,0.28)",
                  color: "rgba(180,210,180,0.8)",
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  padding: 10,
                  cursor: "pointer",
                }}
              >
                REINICIAR RONDA
              </button>
            </div>
          </aside>

          {/* STAGE */}
          <main
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(24px,4vh,48px)",
              padding: "clamp(20px,3vw,48px)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: "min(1100px,94%)",
                border: "1px solid rgba(51,224,58,0.25)",
                background: "rgba(8,12,8,0.5)",
                boxShadow: "0 0 60px rgba(51,224,58,0.06) inset",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: "1px solid rgba(51,224,58,0.16)",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: "rgba(140,200,150,0.7)",
                }}
              >
                <span>{statusText}</span>
                <span style={{ color: "rgba(140,170,140,0.45)" }}>
                  RESTANTES: {pad(available.length)}
                </span>
              </div>

              <div
                style={{
                  padding: "clamp(32px,6vh,72px) clamp(20px,3vw,48px)",
                  minHeight: "clamp(220px,42vh,420px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mode === "terminal" ? (
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <div
                      style={{
                        fontSize: 13,
                        letterSpacing: "0.3em",
                        color: "rgba(140,200,150,0.55)",
                        marginBottom: "clamp(16px,3vh,28px)",
                      }}
                    >
                      {spinning ? ">> EJECUTANDO RANDOM()" : "// EQUIPO_SELECCIONADO"}
                    </div>
                    <div
                      style={{
                        fontFamily: DISPLAY,
                        fontWeight: 700,
                        fontSize: "clamp(40px,8.5vw,140px)",
                        lineHeight: 0.95,
                        letterSpacing: "0.02em",
                        color: GREEN,
                        textShadow: "0 0 28px rgba(51,224,58,0.35)",
                        wordBreak: "break-word",
                      }}
                    >
                      {display}
                      <span
                        style={{
                          display: "inline-block",
                          width: "0.5em",
                          height: "0.85em",
                          background: GREEN,
                          marginLeft: "0.12em",
                          verticalAlign: "baseline",
                          animation: "rp-blink 1s steps(1) infinite",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      position: "relative",
                      width: "min(840px,100%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "clamp(4px,1vh,10px)",
                      overflow: "hidden",
                    }}
                  >
                    {[
                      { t: ghosts[0], s: "clamp(18px,3vw,40px)", c: "rgba(110,170,120,0.22)" },
                      { t: ghosts[1], s: "clamp(22px,3.6vw,52px)", c: "rgba(120,190,130,0.4)" },
                    ].map((g, i) => (
                      <div
                        key={`top${i}`}
                        style={{
                          fontFamily: DISPLAY,
                          fontWeight: 600,
                          fontSize: g.s,
                          color: g.c,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                        }}
                      >
                        {g.t}
                      </div>
                    ))}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        padding: "clamp(8px,1.6vh,16px) 0",
                        borderTop: "1px solid rgba(51,224,58,0.5)",
                        borderBottom: "1px solid rgba(51,224,58,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4em",
                      }}
                    >
                      <span
                        style={{
                          color: GREEN,
                          fontFamily: DISPLAY,
                          fontWeight: 700,
                          fontSize: "clamp(30px,5.5vw,84px)",
                        }}
                      >
                        ›
                      </span>
                      <span
                        style={{
                          fontFamily: DISPLAY,
                          fontWeight: 700,
                          fontSize: "clamp(34px,6vw,92px)",
                          lineHeight: 1,
                          letterSpacing: "0.01em",
                          color: GREEN,
                          textShadow: "0 0 26px rgba(51,224,58,0.4)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "80%",
                        }}
                      >
                        {display}
                      </span>
                      <span
                        style={{
                          color: GREEN,
                          fontFamily: DISPLAY,
                          fontWeight: 700,
                          fontSize: "clamp(30px,5.5vw,84px)",
                        }}
                      >
                        ‹
                      </span>
                    </div>
                    {[
                      { t: ghosts[2], s: "clamp(22px,3.6vw,52px)", c: "rgba(120,190,130,0.4)" },
                      { t: ghosts[3], s: "clamp(18px,3vw,40px)", c: "rgba(110,170,120,0.22)" },
                    ].map((g, i) => (
                      <div
                        key={`bot${i}`}
                        style={{
                          fontFamily: DISPLAY,
                          fontWeight: 600,
                          fontSize: g.s,
                          color: g.c,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                        }}
                      >
                        {g.t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {available.length > 0 ? (
              <button
                onClick={onSpin}
                style={{
                  background: GREEN,
                  color: "#04140a",
                  border: "none",
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: "clamp(22px,2.6vw,38px)",
                  letterSpacing: "0.16em",
                  padding: "clamp(16px,2vh,22px) clamp(48px,7vw,88px)",
                  cursor: "pointer",
                  boxShadow: "0 0 40px rgba(51,224,58,0.3)",
                }}
              >
                {spinning ? "GIRANDO..." : "GIRAR"}
              </button>
            ) : (
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  color: "rgba(160,190,160,0.5)",
                  textAlign: "center",
                }}
              >
                {total === 0
                  ? "> AGREGA EQUIPOS PARA EMPEZAR"
                  : "> TODOS PRESENTARON · REINICIA LA RONDA"}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* WINNER OVERLAY */}
      {winner && (
        <div
          onClick={closeWinner}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(3,6,3,0.92)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(20px,4vh,40px)",
            padding: 24,
          }}
        >
          <div
            style={{
              fontSize: "clamp(12px,1.4vw,16px)",
              letterSpacing: "0.4em",
              color: "rgba(140,200,150,0.7)",
            }}
          >
            &gt; LE TOCA PRESENTAR A
          </div>
          {TEAM_LINKS[winner] ? (
            <a
              href={TEAM_LINKS[winner]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: "min(11vw,17vh,180px)",
                lineHeight: 0.95,
                letterSpacing: "0.01em",
                color: GREEN,
                textAlign: "center",
                textShadow: "0 0 50px rgba(51,224,58,0.45)",
                animation: "rp-winpop .5s ease both, rp-glitch 4s linear infinite",
                wordBreak: "break-word",
                maxWidth: "92vw",
                textDecoration: "underline",
                textUnderlineOffset: "6px",
                cursor: "pointer",
              }}
            >
              {winner}
            </a>
          ) : (
            <div
              style={{
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: "min(11vw,17vh,180px)",
                lineHeight: 0.95,
                letterSpacing: "0.01em",
                color: GREEN,
                textAlign: "center",
                textShadow: "0 0 50px rgba(51,224,58,0.45)",
                animation: "rp-winpop .5s ease both, rp-glitch 4s linear infinite",
                wordBreak: "break-word",
                maxWidth: "92vw",
              }}
            >
              {winner}
            </div>
          )}
          {allDone && (
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.22em",
                color: "rgba(255,180,90,0.85)",
              }}
            >
              // TODOS HAN PRESENTADO — EL POOL SE REINICIARÁ
            </div>
          )}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={closeWinner}
              style={{
                background: GREEN,
                color: "#04140a",
                border: "none",
                fontFamily: DISPLAY,
                fontWeight: 700,
                fontSize: "clamp(15px,1.6vw,20px)",
                letterSpacing: "0.14em",
                padding: "15px 38px",
                cursor: "pointer",
              }}
            >
              {allDone ? "REINICIAR POOL" : "SIGUIENTE EQUIPO"}
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "rgba(150,170,150,0.4)",
            }}
          >
            [ toca cualquier parte para cerrar ]
          </div>
        </div>
      )}
    </div>
  );
}