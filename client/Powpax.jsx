/*
  POWPAX — Single-file marketing site
  -----------------------------------
  Stack: React + Tailwind (assumed available) + GSAP/ScrollTrigger (loaded via CDN in useEffect).

  ScrollTrigger inventory (tweak knobs live here):
    Scene 1  Hero slam        — wordmark judder timeline (no ST). Stick bob/tilt loops.
    Scene 1→2 transition       — id "hero-out". start: "top top", end: "+=60%", scrub:1.
                                 Tweak end to lengthen the rotate-out of the hero stick.
    Scene 2  Pour & Dissolve  — id "pour-pin". start: "top top", end: "+=200%",
                                 scrub:1, pin:true. Lengthen end (e.g. "+=300%") to slow the pour.
                                 Three callouts fire at 0.18 / 0.45 / 0.72 progress.
                                 Final slam fires at 0.95.
    Scene 3  Escape plan       — id "escape-parallax". scrub:1. Background y-parallax 0.5x,
                                 headline 1x, shaka 1.2x. Tweak yPercent values to taste.
    Scene 4  Flavor showdown   — id "flavors-pin" (desktop only via matchMedia ≥768px).
                                 start: "top top", end: "+=300%", scrub:1, pin:true.
                                 Mobile: scroll-snap fallback (no pin) + IntersectionObserver
                                 toggles per-flavor animation classes.
    Scene 5  Stats counters   — id "stats-count". start: "top 70%", once:true. Counts up.
    Scene 6  Lineup pouches   — id "lineup-stagger". start: "top 75%", batch entrance.
    Scene 7  CTA judder       — id "cta-judder". start: "top 80%", once:true.
    Floating accents          — global yoyo loops (no ST).

  Mobile simplifications:
    • No horizontal pin in Scene 4 — scroll-snap row + IO triggers.
    • No long pin in Scene 2 — pour timeline plays on enter (shorter, non-scrubbed).
    • Reduced parallax in Scene 3.
    • prefers-reduced-motion: kills all scrubs/loops, instant fades only.

  Image asset slots (replace IMAGES constant near top):
    • IMAGES.heroStick      — Hero centerpiece stick (Tiki Trip or Citrus Slap).
    • IMAGES.stickCitrus    — Citrus Slap stick.
    • IMAGES.stickZaza      — Zaza Berry stick.
    • IMAGES.stickTiki      — Tiki Trip stick.
    • IMAGES.pouchVariety   — Variety pack (cobalt blue) pouch.
    • IMAGES.pouchCitrus    — Citrus Slap (lime) pouch.
    • IMAGES.pouchTiki      — Tiki Trip (orange) pouch.
    • IMAGES.pouchZaza      — Zaza Berry (magenta-pink) pouch.
    • IMAGES.waterfallBg    — Dark waterfall background for Scene 3.
*/

import React, { useEffect, useRef, useState } from "react";

// ---------- BRAND CONSTANTS ----------
const COPY = {
  wordmark: "POWPAX",
  tagline: "Portable Good Vibes.",
  heroHook: "Fuel Play. Find Flow.",
  subhead: "Made for your next escape and everything in between.",
  about:
    "A THC drink mix crafted to elevate your everyday rituals — a precise balance of fast-acting nano-THC, CBD, and electrolytes. Restores hydration while delivering the experience. No plant taste, no hangover, just clean, feel-good vibes. Whether you're unwinding solo, sparking creativity, or connecting with others, Powpax goes where you go — anytime, anywhere.",
  spec: "3mg Δ9 THC · 6mg CBD · hemp-derived · 6g net weight",
  finalSlam: "NO PLANT TASTE. NO HANGOVER. JUST VIBES.",
  escapeHeadline: "Your portable escape plan.",
  ctaHeadline: "PORTABLE GOOD VIBES.",
  ctaButton: "SHOP THE LINEUP",
  pickHeadline: "PICK YOUR POISON",
};

const COLORS = {
  magenta: "#FF1493",
  lime: "#D4FF3A",
  pink: "#E91E63",
  orange: "#FF6B35",
  cobalt: "#1E3A8A",
  off: "#FAFAFA",
  ink: "#0A0A0A",
};

// Drop-in image slots — swap these strings for real asset URLs.
const IMAGES = {
  heroStick: "/assets/powpax-hero-stick.png",
  stickCitrus: "/assets/powpax-citrus-slap-stick.png",
  stickZaza: "/assets/powpax-zaza-berry-stick.png",
  stickTiki: "/assets/powpax-tiki-trip-stick.png",
  pouchVariety: "/assets/powpax-variety-pouch.png",
  pouchCitrus: "/assets/powpax-citrus-pouch.png",
  pouchTiki: "/assets/powpax-tiki-pouch.png",
  pouchZaza: "/assets/powpax-zaza-pouch.png",
  waterfallBg: "/assets/powpax-waterfall.jpg",
};

const FLAVORS = [
  {
    key: "citrus",
    name: "CITRUS SLAP",
    bg: COLORS.lime,
    type: COLORS.ink,
    accent: "#2F7A1F",
    img: IMAGES.stickCitrus,
    tagline: "Zest, chaos, and a clean left hook.",
    desc: "Bright lemon-lime electrolyte with a citrus snap and a slow-rolling lift.",
    nameClass: "font-black italic tracking-tight",
    motion: "slap",
  },
  {
    key: "zaza",
    name: "ZAZA BERRY",
    bg: COLORS.pink,
    type: COLORS.off,
    accent: "#FF1493",
    img: IMAGES.stickZaza,
    tagline: "Sweet, wild, and a little rebellious.",
    desc: "Wild berry tang with a psychedelic undertow. Loud where it counts.",
    nameClass: "font-black italic tracking-wide",
    motion: "pulse",
  },
  {
    key: "tiki",
    name: "TIKI TRIP",
    bg: COLORS.orange,
    type: COLORS.magenta,
    accent: "#FFFFFF",
    img: IMAGES.stickTiki,
    tagline: "This isn't a drink. It's a detonation.",
    desc: "Tropical mango-passionfruit with a sun-warped finish.",
    nameClass: "italic font-extrabold",
    motion: "swirl",
  },
];

const POUCHES = [
  { key: "variety", img: IMAGES.pouchVariety, name: "Variety Pack", color: COLORS.cobalt },
  { key: "citrus", img: IMAGES.pouchCitrus, name: "Citrus Slap", color: COLORS.lime },
  { key: "tiki", img: IMAGES.pouchTiki, name: "Tiki Trip", color: COLORS.orange },
  { key: "zaza", img: IMAGES.pouchZaza, name: "Zaza Berry", color: COLORS.pink },
];

// ---------- INLINE SVG ICONS ----------
const Bolt = ({ className = "", style }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
  </svg>
);

const Peace = ({ className = "", style }) => (
  <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 2v20M12 12l7 7M12 12l-7 7" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const Shaka = ({ className = "", style }) => (
  <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden="true">
    <path
      d="M14 30c0-4 3-6 6-6 2 0 4 1 5 3V14c0-3 2-5 5-5s5 2 5 5v16c2-2 5-2 7 0 2 1 2 4 1 6l-7 12c-2 4-7 7-12 7H18c-4 0-7-3-7-7v-8c0-4 1-7 3-10z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>
);

const TicTacMark = ({ className = "", style }) => (
  // The secondary "POW/PAX" tic-tac-toe mark.
  <svg viewBox="0 0 80 80" className={className} style={style} aria-hidden="true">
    <path d="M27 6v68M53 6v68M6 27h68M6 53h68" stroke="currentColor" strokeWidth="3" />
    <text x="16" y="22" fontFamily="Arial Black, sans-serif" fontStyle="italic" fontSize="14" fill="currentColor">
      POW
    </text>
    <text x="42" y="68" fontFamily="Arial Black, sans-serif" fontStyle="italic" fontSize="14" fill="currentColor">
      PAX
    </text>
  </svg>
);

// ---------- ROOT ----------
export default function Powpax() {
  const [ageOk, setAgeOk] = useState(false);
  const rootRef = useRef(null);

  // Inject GSAP + ScrollTrigger from CDN, then wire all scroll choreography.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

    let ctx; // gsap.context for cleanup
    let mm;  // matchMedia for desktop-only pin

    (async () => {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js");
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
      );
      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      if (!gsap || !ScrollTrigger) return;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        // Reduced-motion: instant fades only. Skip every scrub/loop.
        if (reduce) {
          gsap.utils.toArray("[data-fade]").forEach((el) => {
            gsap.set(el, { opacity: 1, y: 0 });
          });
          return;
        }

        // ---------- Scene 1: Hero ----------
        // Wordmark judder: 3 micro-offsets in 200ms, then settle. Chromatic aberration on the magenta layer.
        const heroTl = gsap.timeline();
        heroTl
          .from(".hero-wordmark", { y: -120, opacity: 0, duration: 0.35, ease: "power4.out" })
          .to(".hero-wordmark", { x: -4, duration: 0.05 })
          .to(".hero-wordmark", { x: 5, duration: 0.05 })
          .to(".hero-wordmark", { x: -2, duration: 0.05 })
          .to(".hero-wordmark", { x: 0, duration: 0.05 })
          .to(".hero-chroma", { x: 2, duration: 0.05 }, "-=0.2")
          .to(".hero-chroma", { x: 0, duration: 0.25 })
          .from(".hero-hook", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.1")
          .from(".hero-sub", { y: 18, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.3");

        // Hero stick — slow bob + independent tilt loop.
        gsap.to(".hero-stick", {
          y: -14,
          duration: 3,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".hero-stick", {
          rotate: 2,
          duration: 2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        // Edge between color blocks drifts ±20px on a 6s loop.
        gsap.to(".hero-edge", {
          x: 20,
          duration: 6,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        // Floating accent loops (hero, escape, footer).
        gsap.utils.toArray(".float-accent").forEach((el, i) => {
          gsap.to(el, {
            y: -30 - (i % 4) * 12,
            rotate: (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 6),
            duration: 4 + (i % 5),
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: (i % 6) * 0.2,
          });
        });

        // Hero stick begins to tilt/pour as user scrolls past hero.
        // Tweak end:'+=60%' to change how far the rotate-out lasts.
        ScrollTrigger.create({
          id: "hero-out",
          trigger: ".scene-hero",
          start: "top top",
          end: "+=60%",
          scrub: 1,
          animation: gsap.to(".hero-stick", { rotate: -25, ease: "none" }),
        });

        // ---------- Scene 2: Pour & Dissolve (pinned) ----------
        // Pin for ~2 viewport heights. All sub-tweens scrubbed off the same trigger.
        // Lengthen end:'+=200%' to slow the pour; shorten to speed it up.
        const pourTl = gsap.timeline({
          scrollTrigger: {
            id: "pour-pin",
            trigger: ".scene-pour",
            start: "top top",
            end: "+=200%",
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        });
        pourTl
          .to(".pour-stick", { rotate: -55, x: -40, y: -20, ease: "none" }, 0)
          // Liquid stream draws along the curved path.
          .fromTo(
            ".pour-stream",
            { strokeDashoffset: 800 },
            { strokeDashoffset: 0, ease: "none" },
            0
          )
          // Glass fills via clip-path scaleY (transform-only).
          .fromTo(
            ".pour-fill",
            { scaleY: 0 },
            { scaleY: 1, ease: "none" },
            0.05
          )
          // Liquid hue cycles subtly while filling.
          .to(".pour-fill", { filter: "hue-rotate(60deg)", ease: "none" }, 0.2)
          // Particles staggered along the stream.
          .from(".pour-particle", {
            scale: 0,
            opacity: 0,
            stagger: { each: 0.04, from: "random" },
            ease: "none",
          }, 0.1)
          // Three callouts at 0.18 / 0.45 / 0.72.
          .fromTo(".callout-1", { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: "none" }, 0.18)
          .fromTo(".callout-2", { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: "none" }, 0.45)
          .fromTo(".callout-3", { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: "none" }, 0.72)
          // Final slam at 0.95.
          .fromTo(
            ".pour-slam",
            { opacity: 0, scale: 1.2, x: -8 },
            { opacity: 1, scale: 1, x: 0, ease: "none" },
            0.95
          );

        // ---------- Scene 3: Escape parallax ----------
        // y-parallax for bg / headline / shaka — each at a different rate for depth.
        ScrollTrigger.create({
          id: "escape-parallax",
          trigger: ".scene-escape",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
          animation: gsap
            .timeline()
            .to(".escape-bg", { yPercent: -25, ease: "none" }, 0)   // 0.5x
            .to(".escape-headline", { yPercent: -50, ease: "none" }, 0) // 1x
            .to(".escape-shaka", { yPercent: -60, scale: 1.15, ease: "none" }, 0), // 1.2x
        });
        // Headline blur-to-sharp on enter.
        gsap.fromTo(
          ".escape-headline",
          { filter: "blur(12px)", opacity: 0, y: 40 },
          {
            filter: "blur(0px)",
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: ".scene-escape", start: "top 70%" },
          }
        );

        // ---------- Scene 4: Flavor Showdown ----------
        // Desktop: pinned horizontal scroll. Mobile: snap row + IO.
        mm = gsap.matchMedia();
        mm.add("(min-width: 768px)", () => {
          const track = document.querySelector(".flavor-track");
          if (!track) return;
          const distance = track.scrollWidth - window.innerWidth;

          gsap.to(track, {
            x: -distance,
            ease: "none",
            scrollTrigger: {
              id: "flavors-pin",
              trigger: ".scene-flavors",
              start: "top top",
              end: "+=300%",
              scrub: 1,
              pin: true,
              invalidateOnRefresh: true,
            },
          });

          // Per-flavor: bg flood + personality animation as it centers.
          FLAVORS.forEach((f, i) => {
            const cardSel = `.flavor-card-${f.key}`;
            const bgSel = `.flavor-bg-${f.key}`;

            ScrollTrigger.create({
              trigger: cardSel,
              containerAnimation: ScrollTrigger.getById("flavors-pin")?.animation,
              start: "left center",
              end: "right center",
              onEnter: () => floodIn(bgSel, f.bg),
              onEnterBack: () => floodIn(bgSel, f.bg),
              onLeave: () => floodOut(bgSel),
              onLeaveBack: () => floodOut(bgSel),
            });

            // Personality loops — created once, paused, toggled by IO below.
            const stick = document.querySelector(`${cardSel} .flavor-stick`);
            if (!stick) return;
            if (f.motion === "slap") {
              const t = gsap.timeline({ paused: true })
                .to(stick, { rotate: -15, duration: 0.12, ease: "power3.out" })
                .to(stick, { rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
              attachIO(cardSel, () => { t.restart(); });
            } else if (f.motion === "pulse") {
              const t = gsap.to(stick, {
                scale: 1.05,
                duration: 1.1,
                ease: "sine.inOut",
                repeat: -1,
                yoyo: true,
                paused: true,
              });
              attachIO(cardSel, () => t.play(), () => t.pause());
            } else if (f.motion === "swirl") {
              const t = gsap.to(stick, {
                rotate: 360,
                duration: 8,
                ease: "none",
                repeat: -1,
                paused: true,
              });
              attachIO(cardSel, () => t.play(), () => t.pause());
            }
          });
        });

        // Mobile fallback — IO triggers per-flavor animations on the snap row.
        mm.add("(max-width: 767px)", () => {
          FLAVORS.forEach((f) => {
            const cardSel = `.flavor-card-${f.key}`;
            const stick = document.querySelector(`${cardSel} .flavor-stick`);
            if (!stick) return;
            if (f.motion === "slap") {
              attachIO(cardSel, () => {
                gsap.fromTo(stick, { rotate: -15 }, { rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
              });
            } else if (f.motion === "pulse") {
              const t = gsap.to(stick, { scale: 1.05, duration: 1.1, ease: "sine.inOut", repeat: -1, yoyo: true, paused: true });
              attachIO(cardSel, () => t.play(), () => t.pause());
            } else if (f.motion === "swirl") {
              const t = gsap.to(stick, { rotate: 360, duration: 8, ease: "none", repeat: -1, paused: true });
              attachIO(cardSel, () => t.play(), () => t.pause());
            }
          });
        });

        function floodIn(sel, color) {
          gsap.to(sel, { yPercent: 0, duration: 0.6, ease: "power3.out", backgroundColor: color });
        }
        function floodOut(sel) {
          gsap.to(sel, { yPercent: 100, duration: 0.5, ease: "power2.in" });
        }
        function attachIO(sel, onIn, onOut) {
          const el = document.querySelector(sel);
          if (!el) return;
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((e) => {
                if (e.isIntersecting) onIn?.();
                else onOut?.();
              });
            },
            { threshold: 0.5 }
          );
          io.observe(el);
        }

        // ---------- Scene 5: Stats counters ----------
        gsap.utils.toArray(".stat-num").forEach((el) => {
          const target = parseInt(el.dataset.target, 10);
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: { id: "stats-count", trigger: el, start: "top 70%", once: true },
            onUpdate: () => { el.textContent = Math.round(obj.v); },
          });
        });
        // Wave background slow loop.
        gsap.to(".stats-wave", {
          x: -200,
          duration: 14,
          ease: "none",
          repeat: -1,
        });

        // ---------- Scene 6: Lineup pouches ----------
        gsap.utils.toArray(".pouch-card").forEach((el, i) => {
          gsap.fromTo(
            el,
            { opacity: 0, scale: 0.9, rotate: -3 },
            {
              opacity: 1,
              scale: 1,
              rotate: 0,
              duration: 0.7,
              ease: "back.out(1.6)",
              delay: i * 0.12,
              scrollTrigger: { id: "lineup-stagger", trigger: ".scene-lineup", start: "top 75%" },
              keyframes: [
                { rotate: -3 },
                { rotate: 2 },
                { rotate: 0 },
              ],
            }
          );
        });

        // ---------- Scene 7: CTA judder ----------
        gsap.timeline({ scrollTrigger: { id: "cta-judder", trigger: ".scene-cta", start: "top 80%", once: true } })
          .from(".cta-headline", { y: -60, opacity: 0, duration: 0.3, ease: "power4.out" })
          .to(".cta-headline", { x: -3, duration: 0.05 })
          .to(".cta-headline", { x: 4, duration: 0.05 })
          .to(".cta-headline", { x: -2, duration: 0.05 })
          .to(".cta-headline", { x: 0, duration: 0.05 })
          .from(".cta-sub", { opacity: 0, y: 16, duration: 0.5 }, "-=0.1")
          .from(".cta-button", { opacity: 0, scale: 0.9, duration: 0.4, ease: "back.out(1.6)" }, "-=0.2");

      }, rootRef);
    })();

    return () => {
      try { ctx?.revert(); } catch {}
      try { mm?.revert(); } catch {}
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] overflow-x-hidden"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <DisplayFontLoader />

      {ageOk ? null : <AgeGate onConfirm={() => setAgeOk(true)} />}

      <StickyNav />

      <main>
        <HeroScene />
        <PourScene />
        <EscapeScene />
        <FlavorScene />
        <StatsScene />
        <LineupScene />
        <CTAScene />
      </main>

      <Footer />
    </div>
  );
}

// ---------- DISPLAY FONT (Inter for body; Anton Italic via skew for display fallback) ----------
function DisplayFontLoader() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Inter:wght@400;500;700;900&display=swap');
      .font-display {
        font-family: 'Anton', 'Bebas Neue', Impact, 'Arial Black', sans-serif;
        font-style: italic;
        font-weight: 400;
        letter-spacing: -0.01em;
        transform: skewX(-6deg);
        display: inline-block;
      }
      .font-display-tight { font-family: 'Anton', 'Bebas Neue', Impact, sans-serif; font-style: italic; transform: skewX(-6deg); display: inline-block; }
      .groove {
        font-family: 'Anton', 'Bebas Neue', Impact, sans-serif;
        font-style: italic;
        transform: skewX(-10deg) rotate(-2deg);
        display: inline-block;
        letter-spacing: 0.04em;
      }
      .brush {
        font-family: 'Brush Script MT', 'Lucida Handwriting', cursive;
        font-style: italic;
        display: inline-block;
      }
      .nopa { -webkit-tap-highlight-color: transparent; }
    `}</style>
  );
}

// ---------- AGE GATE ----------
function AgeGate({ onConfirm }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Age verification"
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full bg-[#FAFAFA] text-[#0A0A0A] rounded-2xl p-8 shadow-2xl">
        <div className="text-3xl font-display" style={{ color: COLORS.magenta }}>POWPAX</div>
        <h2 className="mt-3 text-2xl font-bold">Are you 21 or older?</h2>
        <p className="mt-2 text-sm leading-relaxed">
          POWPAX is a hemp-derived THC product. By entering you confirm you're of legal age in your jurisdiction.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-full font-bold text-white nopa"
            style={{ backgroundColor: COLORS.magenta }}
            aria-label="Confirm I am 21 or older"
          >
            I'M 21+
          </button>
          <button
            onClick={() => { window.location.href = "https://www.google.com"; }}
            className="flex-1 py-3 rounded-full font-bold border-2 nopa"
            style={{ borderColor: COLORS.ink }}
            aria-label="Exit site"
          >
            EXIT
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- STICKY NAV ----------
function StickyNav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b border-black/5">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TicTacMark className="w-7 h-7" style={{ color: COLORS.magenta }} />
          <span className="font-display text-2xl" style={{ color: COLORS.magenta }}>POWPAX</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold uppercase tracking-wider">
          <a href="#flavors" className="hover:opacity-70">Flavors</a>
          <a href="#about" className="hover:opacity-70">About</a>
          <a href="#lineup" className="hover:opacity-70">Lineup</a>
          <a
            href="#shop"
            className="px-4 py-2 rounded-full text-white"
            style={{ backgroundColor: COLORS.magenta }}
          >
            Shop
          </a>
        </nav>
      </div>
    </header>
  );
}

// ---------- SCENE 1 — HERO ----------
function HeroScene() {
  return (
    <section className="scene-hero relative min-h-[100vh] overflow-hidden" aria-label="Hero">
      {/* Two color blocks meeting on a hard edge */}
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full" style={{ backgroundColor: COLORS.lime }} />
        <div className="w-1/2 h-full" style={{ backgroundColor: COLORS.off }} />
      </div>
      <div
        className="hero-edge absolute top-0 bottom-0 left-1/2 w-[2px]"
        style={{ backgroundColor: COLORS.ink, transform: "translateX(-1px)" }}
      />

      {/* Floating accents (behind stick) */}
      <FloatingAccents seed="hero" count={8} colors={[COLORS.magenta, COLORS.ink]} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-24 grid md:grid-cols-2 gap-10 items-center min-h-[100vh]">
        <div>
          <h1 className="relative leading-[0.85] text-[18vw] md:text-[10vw] font-display" style={{ color: COLORS.magenta }}>
            <span className="hero-chroma absolute inset-0 mix-blend-multiply" style={{ color: "#00E5FF" }} aria-hidden="true">
              {COPY.wordmark}
            </span>
            <span className="hero-wordmark relative inline-block">{COPY.wordmark}</span>
          </h1>
          <p className="hero-hook mt-6 text-3xl md:text-5xl font-black italic" style={{ color: COLORS.ink }}>
            {COPY.heroHook}
          </p>
          <p className="hero-sub mt-4 text-lg md:text-xl max-w-xl leading-relaxed" style={{ color: COLORS.ink }}>
            {COPY.subhead}
          </p>
          <p id="about" className="mt-6 text-base md:text-lg max-w-xl leading-relaxed opacity-80">
            {COPY.about}
          </p>
          <p className="mt-4 text-sm font-semibold uppercase tracking-widest opacity-70">
            {COPY.spec}
          </p>
        </div>

        <div className="relative h-[60vh] md:h-[80vh] flex items-center justify-center">
          <img
            src={IMAGES.heroStick}
            alt="POWPAX Tiki Trip THC + CBD electrolyte stick"
            className="hero-stick max-h-full w-auto drop-shadow-2xl"
            style={{ willChange: "transform" }}
          />
        </div>
      </div>
    </section>
  );
}

// ---------- SCENE 2 — POUR & DISSOLVE ----------
function PourScene() {
  // 14 particles — mix of bolts / peaces / circles
  const particles = Array.from({ length: 14 }).map((_, i) => {
    const cx = 220 + (i * 31) % 360;
    const cy = 180 + (i * 47) % 380;
    const colors = [COLORS.magenta, COLORS.lime, COLORS.orange];
    const c = colors[i % 3];
    const kind = i % 3;
    return { cx, cy, c, kind, i };
  });

  return (
    <section className="scene-pour relative h-screen w-full overflow-hidden" style={{ backgroundColor: COLORS.off }}>
      <div className="absolute inset-0">
        {/* Gradient mask for the kaleidoscopic stream */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="pourGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={COLORS.lime} />
              <stop offset="50%" stopColor={COLORS.magenta} />
              <stop offset="100%" stopColor={COLORS.orange} />
            </linearGradient>
            <clipPath id="glassClip">
              <path d="M340 360 L460 360 L450 700 L350 700 Z" />
            </clipPath>
          </defs>

          {/* Stream path drawn by stroke-dashoffset */}
          <path
            className="pour-stream"
            d="M220 180 C 260 280, 360 300, 400 380"
            fill="none"
            stroke="url(#pourGrad)"
            strokeWidth="22"
            strokeLinecap="round"
            strokeDasharray="800"
            strokeDashoffset="800"
          />

          {/* Glass outline */}
          <path d="M340 360 L460 360 L450 700 L350 700 Z" fill="none" stroke={COLORS.ink} strokeWidth="4" />

          {/* Liquid fill — scaleY transform-origin bottom */}
          <g clipPath="url(#glassClip)">
            <rect
              className="pour-fill"
              x="340"
              y="360"
              width="120"
              height="340"
              fill="url(#pourGrad)"
              style={{ transformOrigin: "350px 700px", transformBox: "fill-box" }}
            />
          </g>

          {/* Particles */}
          {particles.map((p) => (
            <g key={p.i} className="pour-particle" style={{ color: p.c }}>
              {p.kind === 0 && <circle cx={p.cx} cy={p.cy} r="6" fill={p.c} />}
              {p.kind === 1 && (
                <g transform={`translate(${p.cx - 12} ${p.cy - 12}) scale(1)`}>
                  <Bolt className="w-6 h-6" style={{ color: p.c }} />
                </g>
              )}
              {p.kind === 2 && (
                <g transform={`translate(${p.cx - 12} ${p.cy - 12})`}>
                  <Peace className="w-6 h-6" style={{ color: p.c }} />
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* Stick image positioned top-left */}
        <img
          src={IMAGES.heroStick}
          alt=""
          aria-hidden="true"
          className="pour-stick absolute top-[10%] left-[14%] w-[18vw] min-w-[140px] max-w-[260px] origin-bottom drop-shadow-xl"
        />
      </div>

      {/* Callouts */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 h-full flex flex-col justify-center">
        <ul className="ml-auto w-full md:w-1/2 space-y-6 text-right">
          <li className="callout-1 flex items-center gap-3 justify-end opacity-0">
            <span className="text-2xl md:text-4xl font-black italic">3mg nano-Δ9 THC</span>
            <Bolt className="w-8 h-8" style={{ color: COLORS.magenta }} />
          </li>
          <li className="callout-2 flex items-center gap-3 justify-end opacity-0">
            <span className="text-2xl md:text-4xl font-black italic">6mg CBD</span>
            <Peace className="w-8 h-8" style={{ color: COLORS.magenta }} />
          </li>
          <li className="callout-3 flex items-center gap-3 justify-end opacity-0">
            <span className="text-2xl md:text-4xl font-black italic">Electrolytes that actually work</span>
            <Shaka className="w-9 h-9" style={{ color: COLORS.magenta }} />
          </li>
        </ul>

        <h2
          className="pour-slam mt-12 font-display text-[8vw] md:text-[5vw] leading-[0.9] opacity-0"
          style={{ color: COLORS.magenta }}
        >
          {COPY.finalSlam}
        </h2>
      </div>
    </section>
  );
}

// ---------- SCENE 3 — ESCAPE ----------
function EscapeScene() {
  return (
    <section className="scene-escape relative min-h-[110vh] overflow-hidden" aria-label="Your portable escape plan">
      <div
        className="escape-bg absolute inset-0 -top-[10%] -bottom-[10%] bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url(${IMAGES.waterfallBg})`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 max-w-6xl mx-auto px-6 h-[110vh] flex flex-col justify-end pb-24">
        <h2
          className="escape-headline font-display text-[12vw] md:text-[8vw] leading-[0.9]"
          style={{ color: COLORS.magenta }}
        >
          {COPY.escapeHeadline}
        </h2>
        <Shaka
          className="escape-shaka absolute bottom-0 left-1/2 -translate-x-1/2 w-40 md:w-64"
          style={{ color: "rgba(255,255,255,0.85)" }}
        />
      </div>
    </section>
  );
}

// ---------- SCENE 4 — FLAVOR SHOWDOWN ----------
function FlavorScene() {
  return (
    <section
      id="flavors"
      className="scene-flavors relative h-screen md:h-screen w-full overflow-hidden"
      aria-label="Flavor showdown"
    >
      {/* Per-flavor flood-in bg layers (start hidden below) */}
      {FLAVORS.map((f) => (
        <div
          key={`bg-${f.key}`}
          className={`flavor-bg-${f.key} absolute inset-0 pointer-events-none`}
          style={{ backgroundColor: f.bg, transform: "translateY(100%)" }}
          aria-hidden="true"
        />
      ))}

      {/* Track — desktop horizontal pin / mobile snap row */}
      <div className="relative h-full w-full">
        <div
          className="flavor-track flex h-full md:flex-nowrap md:w-[300vw] overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none"
          style={{ scrollbarWidth: "none" }}
        >
          {FLAVORS.map((f) => (
            <FlavorCard key={f.key} flavor={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FlavorCard({ flavor }) {
  return (
    <article
      className={`flavor-card-${flavor.key} relative flex-shrink-0 snap-center w-screen md:w-screen h-full flex items-center justify-center px-6`}
    >
      <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center max-w-6xl w-full">
        <div className="flex justify-center">
          <img
            src={flavor.img}
            alt={`POWPAX ${flavor.name} stick`}
            className="flavor-stick max-h-[70vh] w-auto drop-shadow-2xl"
            style={{ willChange: "transform" }}
          />
        </div>
        <div style={{ color: flavor.type }}>
          <h3
            className={
              flavor.motion === "swirl"
                ? "brush text-[14vw] md:text-[8vw] leading-none"
                : flavor.motion === "pulse"
                ? "groove text-[12vw] md:text-[7vw] leading-[0.9] font-black"
                : "font-display text-[12vw] md:text-[7vw] leading-[0.9]"
            }
            style={{ color: flavor.type }}
          >
            {flavor.name}
          </h3>
          <p className="mt-4 text-2xl md:text-3xl font-bold italic">{flavor.tagline}</p>
          <p className="mt-3 text-base md:text-lg max-w-md opacity-90 leading-relaxed">{flavor.desc}</p>
        </div>
      </div>
    </article>
  );
}

// ---------- SCENE 5 — STATS ----------
function StatsScene() {
  const stats = [
    { n: 3, label: "mg nano-Δ9 THC" },
    { n: 6, label: "mg CBD" },
    { n: 10, label: "sticks per pouch" },
    { n: 0, label: "hangovers" },
  ];
  return (
    <section className="scene-stats relative py-24 overflow-hidden" style={{ backgroundColor: COLORS.off }}>
      <svg
        className="stats-wave absolute inset-x-0 top-1/2 -translate-y-1/2 w-[200%] h-40 opacity-25"
        viewBox="0 0 1600 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 50 Q 200 0 400 50 T 800 50 T 1200 50 T 1600 50 V100 H0Z" fill={COLORS.magenta} />
      </svg>
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <h2 className="font-display text-5xl md:text-7xl mb-12" style={{ color: COLORS.ink }}>
          BY THE NUMBERS.
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <div
                className="stat-num font-display text-7xl md:text-9xl leading-none"
                data-target={s.n}
                style={{ color: COLORS.magenta }}
              >
                0
              </div>
              <div className="mt-2 text-sm md:text-base font-semibold uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- SCENE 6 — LINEUP ----------
function LineupScene() {
  return (
    <section id="lineup" className="scene-lineup relative py-24 overflow-hidden" style={{ backgroundColor: COLORS.off }}>
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-display text-6xl md:text-8xl text-center mb-14" style={{ color: COLORS.magenta }}>
          {COPY.pickHeadline}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {POUCHES.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-label={`Shop ${p.name}`}
              className="pouch-card group relative bg-white rounded-2xl p-4 md:p-6 transition-transform duration-300 ease-out nopa"
              style={{ willChange: "transform" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = `0 18px 40px ${p.color}55`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
              onClick={() => { window.location.hash = "#shop"; }}
            >
              <img src={p.img} alt={`POWPAX ${p.name} pouch`} className="w-full h-48 md:h-64 object-contain" />
              <div className="mt-3 font-bold text-lg" style={{ color: p.color }}>
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Floating bolts + peace, opposite rotations */}
      <div className="pointer-events-none absolute bottom-6 right-6 flex gap-6 opacity-50">
        <Bolt className="float-accent w-12 h-12" style={{ color: COLORS.magenta }} />
        <Peace className="float-accent w-12 h-12" style={{ color: COLORS.magenta, transform: "rotate(0deg)" }} />
      </div>
    </section>
  );
}

// ---------- SCENE 7 — CTA FOOTER ----------
function CTAScene() {
  return (
    <section
      id="shop"
      className="scene-cta relative py-32 overflow-hidden"
      style={{ backgroundColor: COLORS.magenta }}
      aria-label="Shop the lineup"
    >
      <FloatingAccents seed="cta" count={10} colors={[COLORS.lime, COLORS.off]} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <h2
          className="cta-headline font-display text-[14vw] md:text-[9vw] leading-[0.85]"
          style={{ color: COLORS.lime }}
        >
          {COPY.ctaHeadline}
        </h2>
        <p className="cta-sub mt-6 text-xl md:text-2xl text-white/90 font-semibold">
          {COPY.subhead}
        </p>
        <button
          type="button"
          className="cta-button group relative mt-10 inline-flex items-center justify-center overflow-hidden px-10 py-5 rounded-full text-lg md:text-xl font-black uppercase tracking-widest nopa"
          style={{ backgroundColor: COLORS.off, color: COLORS.ink }}
          aria-label={COPY.ctaButton}
          onClick={() => { window.location.hash = "#lineup"; }}
        >
          <span className="relative z-10 transition-colors duration-300 group-hover:text-[#0A0A0A]">
            {COPY.ctaButton}
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0 group-hover:h-full transition-[height] duration-500 ease-out"
            style={{ backgroundColor: COLORS.lime }}
          />
        </button>
      </div>
    </section>
  );
}

// ---------- FLOATING ACCENTS ----------
function FloatingAccents({ seed = "x", count = 6, colors = ["#FF1493"] }) {
  // Deterministic pseudo-random based on seed+index — no localStorage, no Math.random per render.
  const items = Array.from({ length: count }).map((_, i) => {
    const h = hash(`${seed}-${i}`);
    const left = (h % 100);
    const top = ((h >> 3) % 90);
    const size = 24 + (h % 28);
    const rot = (h % 60) - 30;
    const c = colors[i % colors.length];
    const kind = i % 3;
    return { left, top, size, rot, c, kind, i };
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {items.map((it) => (
        <div
          key={it.i}
          className="float-accent absolute opacity-40"
          style={{
            left: `${it.left}%`,
            top: `${it.top}%`,
            width: it.size,
            height: it.size,
            transform: `rotate(${it.rot}deg)`,
            color: it.c,
          }}
        >
          {it.kind === 0 && <Bolt className="w-full h-full" style={{ color: it.c }} />}
          {it.kind === 1 && <Peace className="w-full h-full" style={{ color: it.c }} />}
          {it.kind === 2 && <TicTacMark className="w-full h-full" style={{ color: it.c }} />}
        </div>
      ))}
    </div>
  );
}

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ---------- FOOTER ----------
function Footer() {
  return (
    <footer className="bg-[#0A0A0A] text-[#FAFAFA] py-12">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8 items-start">
        <div>
          <div className="flex items-center gap-2">
            <TicTacMark className="w-7 h-7" style={{ color: COLORS.magenta }} />
            <span className="font-display text-2xl" style={{ color: COLORS.magenta }}>POWPAX</span>
          </div>
          <p className="mt-3 text-sm opacity-70 max-w-xs">{COPY.tagline}</p>
        </div>
        <div className="text-xs opacity-70 leading-relaxed">
          <strong className="block mb-1 opacity-100">21+ ONLY.</strong>
          Hemp-derived Δ9 THC product. Keep out of reach of children and pets. Do not operate vehicles or
          machinery while consuming. These statements have not been evaluated by the FDA. Not for sale where
          prohibited.
        </div>
        <div className="flex md:justify-end gap-4 items-center">
          <a href="#" aria-label="Instagram" className="opacity-80 hover:opacity-100">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 2c2.7 0 3 0 4.1.1 2.6.1 3.8 1.4 3.9 3.9.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c-.1 2.6-1.4 3.8-3.9 3.9-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-2.6-.1-3.8-1.4-3.9-3.9C4 15 4 14.7 4 12s0-3 .1-4.1c.1-2.6 1.4-3.8 3.9-3.9C9 4 9.3 4 12 4zm0 3a5 5 0 100 10 5 5 0 000-10zm6.5-.5a1 1 0 110 2 1 1 0 010-2zM12 9a3 3 0 110 6 3 3 0 010-6z"/></svg>
          </a>
          <a href="#" aria-label="TikTok" className="opacity-80 hover:opacity-100">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M14 3v10.5a2.5 2.5 0 11-2.5-2.5H12V8.5a6 6 0 106 6V8.8a7 7 0 003.5 1V6.3A4 4 0 0118 3h-4z"/></svg>
          </a>
          <a href="#" aria-label="X" className="opacity-80 hover:opacity-100">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M18 3h3l-7 8 8 10h-6l-5-6-5 6H3l7-9L3 3h6l5 5 4-5z"/></svg>
          </a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-10 text-xs opacity-60">
        © {new Date().getFullYear()} POWPAX. All rights reserved.
      </div>
    </footer>
  );
}
