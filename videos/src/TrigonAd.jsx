import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Video,
  Img,
  staticFile,
} from "remotion";

// ── helpers ──────────────────────────────────────────────────────────────────

const easeOut = Easing.out(Easing.cubic);

const fadeIn = (frame, start, duration) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

const fadeOut = (frame, start, duration) =>
  interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

const slideUp = (frame, start, fps) =>
  spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 120 }, from: 60, to: 0 });

// ── background ───────────────────────────────────────────────────────────────

const NeonBg = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at 50% 30%, #0d0d2b 0%, #060610 70%)",
    }}
  />
);

// Animated floating particles (pure CSS/JS, no canvas)
const Particles = () => {
  const frame = useCurrentFrame();
  const particles = Array.from({ length: 18 }, (_, i) => {
    const seed = i * 137.5;
    const x = (Math.sin(seed) * 0.5 + 0.5) * 100;
    const baseY = (Math.cos(seed * 1.3) * 0.5 + 0.5) * 100;
    const speed = 0.03 + (i % 5) * 0.01;
    const y = ((baseY + frame * speed) % 110) - 5;
    const size = 2 + (i % 4) * 1.5;
    const colors = ["#88ffff", "#ff66aa", "#a855f7", "#00ff88"];
    const color = colors[i % 4];
    const opacity = 0.3 + Math.sin(frame * 0.05 + seed) * 0.2;
    return { x, y, size, color, opacity, key: i };
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {particles.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            filter: "blur(0.5px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ── Section 1: Hook — gameplay video (0-90f / 0-3s) ─────────────────────────

const HookSection = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const alpha = fadeIn(frame, 0, 15);
  const titleY = slideUp(frame, 10, fps);
  const titleAlpha = fadeIn(frame, 10, 20);

  return (
    <AbsoluteFill>
      {/* gameplay video — fill frame, slightly zoomed */}
      <AbsoluteFill style={{ opacity: 0.75 }}>
        <Video
          src={staticFile("gameplay.mov")}
          startFrom={0}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      {/* dark vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(6,6,16,0.7) 0%, rgba(6,6,16,0.1) 40%, rgba(6,6,16,0.1) 60%, rgba(6,6,16,0.85) 100%)",
        }}
      />

      {/* neon scan-line */}
      <AbsoluteFill style={{ opacity: alpha * 0.4 }}>
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${(i / 24) * 100}%`,
              height: 1,
              background: "rgba(136,255,255,0.07)",
            }}
          />
        ))}
      </AbsoluteFill>

      {/* top label */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleAlpha,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(136,255,255,0.12)",
            border: "1px solid rgba(136,255,255,0.35)",
            borderRadius: 40,
            padding: "12px 48px",
            color: "#88ffff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          NEON BULLET HELL
        </div>
      </div>

      {/* big game title bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleAlpha,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 160,
            fontWeight: 900,
            color: "#ffffff",
            textShadow:
              "0 0 40px #88ffff, 0 0 80px #88ffff, 0 0 160px rgba(136,255,255,0.5)",
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          TRIGON
        </div>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 44,
            fontWeight: 400,
            color: "rgba(136,255,255,0.85)",
            letterSpacing: 12,
            marginTop: 8,
          }}
        >
          X
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Section 2: Feature slides (90-330f / 3-11s) ──────────────────────────────

const screenshots = [
  {
    file: "screenshots/Simulator Screenshot - iPhone 17 Pro - 2026-04-12 at 11.34.43.png",
    label: "SURVIVE THE SWARM",
    sub: "Dodge bullets, destroy waves",
    accent: "#88ffff",
  },
  {
    file: "screenshots/Simulator Screenshot - iPhone 17 Pro - 2026-04-12 at 11.32.25.png",
    label: "PRESTIGE & UPGRADE",
    sub: "Unlock permanent power",
    accent: "#ff66aa",
  },
  {
    file: "screenshots/Simulator Screenshot - iPhone 17 Pro - 2026-04-12 at 11.33.32.png",
    label: "DRAFT YOUR BUILD",
    sub: "Choose upgrades every wave",
    accent: "#a855f7",
  },
  {
    file: "screenshots/Simulator Screenshot - iPhone 17 Pro - 2026-04-12 at 11.33.08.png",
    label: "CHOOSE YOUR SHIP",
    sub: "3 unique ship models",
    accent: "#00ff88",
  },
];

const FeatureSlide = ({ screenshot, localFrame, fps }) => {
  const { label, sub, file, accent } = screenshot;

  const alpha = fadeIn(localFrame, 0, 12);
  const outAlpha =
    localFrame > 45 ? fadeOut(localFrame, 45, 12) : 1;
  const finalAlpha = alpha * outAlpha;

  const phoneY = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 100 },
    from: 80,
    to: 0,
  });

  const textY = spring({
    frame: localFrame - 8,
    fps,
    config: { damping: 18, stiffness: 140 },
    from: 40,
    to: 0,
  });
  const textAlpha = fadeIn(localFrame, 8, 15);

  return (
    <AbsoluteFill
      style={{ opacity: finalAlpha }}
    >
      <NeonBg />
      <Particles />

      {/* phone frame */}
      <div
        style={{
          position: "absolute",
          top: 180,
          left: "50%",
          transform: `translateX(-50%) translateY(${phoneY}px)`,
          width: 500,
          borderRadius: 52,
          overflow: "hidden",
          boxShadow: `0 0 60px ${accent}55, 0 0 120px ${accent}22, 0 40px 80px rgba(0,0,0,0.6)`,
          border: `2px solid ${accent}55`,
        }}
      >
        <Img
          src={staticFile(file)}
          style={{ width: "100%", display: "block" }}
        />
      </div>

      {/* text */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: textAlpha,
          transform: `translateY(${textY}px)`,
          padding: "0 60px",
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 900,
            color: accent,
            textShadow: `0 0 30px ${accent}, 0 0 60px ${accent}88`,
            letterSpacing: 2,
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 40,
            fontWeight: 400,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: 1,
          }}
        >
          {sub}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FeaturesSection = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideFrames = 60; // each slide = 2s

  const currentSlide = Math.min(
    Math.floor(frame / slideFrames),
    screenshots.length - 1
  );
  const localFrame = frame - currentSlide * slideFrames;

  return (
    <FeatureSlide
      screenshot={screenshots[currentSlide]}
      localFrame={localFrame}
      fps={fps}
    />
  );
};

// ── Section 3: CTA (330-450f / 11-15s) ──────────────────────────────────────

const CTASection = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgAlpha = fadeIn(frame, 0, 20);
  const logoY = slideUp(frame, 5, fps);
  const logoAlpha = fadeIn(frame, 5, 25);
  const taglineAlpha = fadeIn(frame, 25, 20);
  const taglineY = slideUp(frame, 25, fps);
  const btnAlpha = fadeIn(frame, 45, 20);
  const btnY = slideUp(frame, 45, fps);
  const storeAlpha = fadeIn(frame, 65, 20);

  const pulse = 1 + Math.sin(frame * 0.12) * 0.025;

  return (
    <AbsoluteFill style={{ opacity: bgAlpha }}>
      <NeonBg />
      <Particles />

      {/* grid lines decoration */}
      <AbsoluteFill style={{ opacity: 0.15 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${i * 11}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background:
                "linear-gradient(to bottom, transparent, #88ffff 50%, transparent)",
            }}
          />
        ))}
      </AbsoluteFill>

      {/* logo */}
      <div
        style={{
          position: "absolute",
          top: 260,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: logoAlpha,
          transform: `translateY(${logoY}px) scale(${pulse})`,
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 200,
            fontWeight: 900,
            color: "#ffffff",
            textShadow:
              "0 0 40px #88ffff, 0 0 100px #88ffff, 0 0 200px rgba(136,255,255,0.4)",
            letterSpacing: -8,
            lineHeight: 1,
          }}
        >
          TRIGON
        </div>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 52,
            fontWeight: 400,
            color: "rgba(136,255,255,0.9)",
            letterSpacing: 16,
            marginTop: -10,
          }}
        >
          X
        </div>
      </div>

      {/* tagline */}
      <div
        style={{
          position: "absolute",
          top: 680,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: taglineAlpha,
          transform: `translateY(${taglineY}px)`,
          padding: "0 80px",
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 48,
            fontWeight: 400,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: 3,
            lineHeight: 1.4,
          }}
        >
          The neon bullet-hell you
          <br />
          can't put down
        </div>
      </div>

      {/* feature pills */}
      <div
        style={{
          position: "absolute",
          top: 880,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 24,
          opacity: taglineAlpha,
          transform: `translateY(${taglineY}px)`,
          flexWrap: "wrap",
          padding: "0 60px",
        }}
      >
        {["Auto-Fire", "Draft Upgrades", "Boss Battles", "Prestige System"].map((pill, i) => (
          <div
            key={i}
            style={{
              background: "rgba(136,255,255,0.08)",
              border: "1px solid rgba(136,255,255,0.3)",
              borderRadius: 32,
              padding: "14px 36px",
              color: "#88ffff",
              fontFamily: "system-ui, sans-serif",
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            {pill}
          </div>
        ))}
      </div>

      {/* CTA button */}
      <div
        style={{
          position: "absolute",
          bottom: 340,
          left: "50%",
          transform: `translateX(-50%) translateY(${btnY}px)`,
          opacity: btnAlpha,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #88ffff 0%, #00aaff 100%)",
            borderRadius: 60,
            padding: "40px 120px",
            color: "#06061a",
            fontFamily: "system-ui, sans-serif",
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: 3,
            textTransform: "uppercase",
            boxShadow: "0 0 60px rgba(136,255,255,0.6), 0 20px 60px rgba(0,0,0,0.4)",
            transform: `scale(${pulse})`,
          }}
        >
          PLAY NOW
        </div>
      </div>

      {/* store badges text */}
      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: storeAlpha,
          fontFamily: "system-ui, sans-serif",
          fontSize: 32,
          fontWeight: 500,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: 4,
        }}
      >
        APP STORE
      </div>
    </AbsoluteFill>
  );
};

// ── Root composition ──────────────────────────────────────────────────────────

// Instagram Reels'de altta ~250px UI (like/comment/share) kaplıyor.
// İçeriği üst 1670px'e sıkıştırıp altını boş bırakıyoruz.
const INSTAGRAM_BOTTOM_SAFE = 250;

export const TrigonAd = () => {
  return (
    <AbsoluteFill style={{ background: "#06061a", fontFamily: "system-ui, sans-serif" }}>
      {/* içerik alanı — altta Instagram UI boşluğu kadar kısaltılmış */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: INSTAGRAM_BOTTOM_SAFE, overflow: "hidden" }}>
        {/* Section 1: Hook with gameplay video — 0-90f (3s) */}
        <Sequence from={0} durationInFrames={90}>
          <HookSection />
        </Sequence>

        {/* Section 2: Feature slides — 90-330f (8s, 4 slides × 2s) */}
        <Sequence from={90} durationInFrames={240}>
          <FeaturesSection />
        </Sequence>

        {/* Section 3: CTA — 330-450f (4s) */}
        <Sequence from={330} durationInFrames={120}>
          <CTASection />
        </Sequence>
      </div>

      {/* Instagram link alanı — boş, koyu */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: INSTAGRAM_BOTTOM_SAFE,
          background: "#06061a",
        }}
      />
    </AbsoluteFill>
  );
};
