import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PlayIcon, ArrowLeftIcon, ArrowRightIcon, XIcon, StackSimpleIcon, TargetIcon, DnaIcon, TrophyIcon, FileTextIcon, WarningOctagonIcon, PulseIcon, BooksIcon } from "@phosphor-icons/react";

/**
 * 8-step SIH walkthrough. Uses real navigation + spotlight highlight (no fake popups).
 * Steps drive the user through actual product surfaces.
 */
const STEPS = [
  { title: "Live Drilling Situation", route: "/", target: '[data-testid="live-ticker"]',
    icon: PulseIcon,
    body: "The live rig telemetry streams every 2s. Notice torque and ROP; red values mean an anomaly threshold is being crossed right now.",
  },
  { title: "Operational Situation Detected", route: "/alerts", target: '[data-testid="situations-list"]',
    icon: StackSimpleIcon,
    body: "Raw signal breaches don't help engineers. We cluster them into meaningful situations — Torque Escalation, ROP Deterioration, Combined Operational Anomaly.",
  },
  { title: "Recall Similar Historical Experiences", route: "/recall", target: '[data-testid="similar-experiences"]',
    icon: TargetIcon,
    body: "RigRecall searches Experience Memory for drilling situations with the same signature — same formation, symptoms, depth, and parameters. Not just nearby wells.",
  },
  { title: "Explain the Similarity Fingerprint", route: "/recall", target: '[data-testid="similarity-radar"]',
    icon: TargetIcon,
    body: "Each match has a component breakdown — event, symptom, depth, formation, parameter — with visible weights. No unexplained percentages. Every match is defensible.",
  },
  { title: "Open Experience DNA", route: "/cases/CASE-001", target: '[data-testid="experience-dna"]',
    icon: DnaIcon,
    body: "This is the signature innovation. Every historical case is a reusable DNA: CONTEXT → EVENT → ACTION → OUTCOME → LESSON → EVIDENCE. Each step traces back to its source.",
  },
  { title: "What Worked Before?", route: "/what-worked", target: '[data-testid="safety-disclaimer"]',
    icon: TrophyIcon,
    body: "Aggregate the same action family across similar cases. Show success rate, evidence strength, average time and cost. Never a recommendation — historical evidence only.",
  },
  { title: "Verify With Evidence", route: "/evidence", target: '[data-testid="evidence-list"]',
    icon: FileTextIcon,
    body: "Every field in Experience DNA is backed by an original source — mud log, sensor trace, daily drilling report. Confidence scores are visible.",
  },
  { title: "Uncertainty Awareness", route: "/conflicts", target: '[data-testid="conflict-summary"]',
    icon: WarningOctagonIcon,
    body: "Where sensor data and human reports disagree, we flag the conflict with impact level, why it matters, and require human review. RigRecall knows what it doesn't know.",
  },
];

const OUTRO = {
  title: "RigRecall",
  body: "RigRecall does not replace the drilling engineer or make autonomous decisions. It transforms fragmented historical drilling experience into evidence-backed organizational memory.",
};

function Spotlight({ selector }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!selector) return;
    let raf;
    const measure = () => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
        }, 500);
      }
      raf = requestAnimationFrame(() => {}); // reschedule
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selector]);

  if (!rect) return null;
  return (
    <>
      {/* Four darkened borders around the spotlight (no overlay covering the target) */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: rect.top, background: "rgba(10,10,10,0.55)", pointerEvents: "none", zIndex: 40 }} />
      <div style={{ position: "fixed", top: rect.top + rect.height, left: 0, right: 0, bottom: 0, background: "rgba(10,10,10,0.55)", pointerEvents: "none", zIndex: 40 }} />
      <div style={{ position: "fixed", top: rect.top, left: 0, width: rect.left, height: rect.height, background: "rgba(10,10,10,0.55)", pointerEvents: "none", zIndex: 40 }} />
      <div style={{ position: "fixed", top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height, background: "rgba(10,10,10,0.55)", pointerEvents: "none", zIndex: 40 }} />

      {/* Amber ring around the target */}
      <div style={{
        position: "fixed", top: rect.top, left: rect.left, width: rect.width, height: rect.height,
        border: "2px solid #FFB000", boxShadow: "0 0 0 1px #FFB000, 0 0 30px rgba(255,176,0,0.6)",
        pointerEvents: "none", zIndex: 41,
      }} />
    </>
  );
}

export default function PresentationMode() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const active = params.get("demo") === "1";
  const stepIdx = parseInt(params.get("step") || "0", 10);
  const done = params.get("done") === "1";

  useEffect(() => {
    if (!active || done) return;
    const step = STEPS[stepIdx];
    if (step && loc.pathname !== step.route) {
      nav(`${step.route}?demo=1&step=${stepIdx}`, { replace: true });
    }
  }, [active, done, stepIdx, loc.pathname, nav]);

  if (!active) {
    return (
      <button
        onClick={() => nav("/?demo=1&step=0")}
        data-testid="start-demo-btn"
        className="fixed bottom-6 right-6 z-30 bg-[#FFB000] text-black font-display font-black tracking-widest text-[11px] px-4 py-3 flex items-center gap-2 shadow-lg hover:bg-[#FFC940] transition-colors"
      >
        <PlayIcon size={14} weight="fill" />
        START SIH DEMO
      </button>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 pointer-events-auto" data-testid="demo-outro">
        <div className="border border-[#FFB000] bg-[#121212] p-8 max-w-xl mx-4">
          <div className="flex items-center gap-2 mb-4">
            <BooksIcon size={22} weight="fill" className="text-[#FFB000]" />
            <div className="font-display font-black text-2xl">{OUTRO.title}</div>
          </div>
          <div className="text-[14px] text-[#E4E4E7] leading-relaxed mb-6 italic">
            &ldquo;{OUTRO.body}&rdquo;
          </div>
          <button onClick={() => nav(loc.pathname, { replace: true })}
            data-testid="demo-close-outro"
            className="btn-amber">CLOSE</button>
        </div>
      </div>
    );
  }

  const step = STEPS[stepIdx];
  if (!step) return null;
  const StepIcon = step.icon;
  const goto = (i) => nav(`${STEPS[i].route}?demo=1&step=${i}`, { replace: true });
  const exit = () => nav(loc.pathname, { replace: true });
  const finish = () => nav(`${loc.pathname}?demo=1&done=1`, { replace: true });

  return (
    <>
      <Spotlight selector={step.target} />

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[720px] max-w-[95vw] border border-[#FFB000] bg-[#121212]" data-testid="demo-panel">
        <div className="px-5 py-3 border-b border-[#262626] bg-[#0A0A0A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StepIcon size={16} weight="fill" className="text-[#FFB000]" />
            <div className="font-display font-black tracking-widest text-[11px] text-[#FFB000]">SIH DEMO · STEP {stepIdx + 1} / {STEPS.length}</div>
          </div>
          <button onClick={exit} className="text-[#71717A] hover:text-white transition-colors" data-testid="demo-exit">
            <XIcon size={16} weight="bold" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#262626]">
          <div className="h-full bg-[#FFB000] transition-all" style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="p-5">
          <div className="font-display font-black text-xl mb-2" data-testid="demo-title">{step.title}</div>
          <div className="text-[13px] text-[#E4E4E7] leading-relaxed" data-testid="demo-body">{step.body}</div>
        </div>

        <div className="px-5 py-3 border-t border-[#262626] flex items-center justify-between">
          <button onClick={() => goto(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0}
            data-testid="demo-prev"
            className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1">
            <ArrowLeftIcon size={11} weight="bold" /> PREVIOUS
          </button>

          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => goto(i)}
                data-testid={`demo-dot-${i}`}
                className={`w-2 h-2 transition-colors ${i === stepIdx ? "bg-[#FFB000]" : i < stepIdx ? "bg-[#71717A]" : "bg-[#262626]"}`} />
            ))}
          </div>

          {stepIdx < STEPS.length - 1 ? (
            <button onClick={() => goto(stepIdx + 1)}
              data-testid="demo-next"
              className="btn-amber flex items-center gap-1">
              NEXT <ArrowRightIcon size={11} weight="bold" />
            </button>
          ) : (
            <button onClick={finish}
              data-testid="demo-finish"
              className="btn-amber flex items-center gap-1">
              FINISH <ArrowRightIcon size={11} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
