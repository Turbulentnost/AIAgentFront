import { useEffect, useRef, useState } from "react";

export type SidebarConnectorPhase = "draw" | "bubble" | "solid" | "pulse" | "retract";

const FORWARD_TIMING_MS: Record<Exclude<SidebarConnectorPhase, "retract">, number> = {
  draw: 520,
  bubble: 380,
  solid: 280,
  pulse: 620
};

const BACKWARD_TIMING_MS = {
  pop: 520,
  retractStart: 260,
  retract: 380
};

function buildDoneConnectors(upToStep: number) {
  const done = new Set<number>();
  for (let index = 0; index < upToStep; index += 1) {
    done.add(index);
  }
  return done;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function applySnapState(activeIndex: number) {
  return {
    visualActiveIndex: activeIndex,
    doneConnectors: buildDoneConnectors(activeIndex),
    connectorPhase: null as SidebarConnectorPhase | null,
    activeConnector: null as number | null,
    bouncingStep: null as number | null,
    poppingStep: null as number | null,
    leavingStep: null as number | null
  };
}

export function useSidebarStepAnimation(activeIndex: number) {
  const [visualActiveIndex, setVisualActiveIndex] = useState(activeIndex);
  const [doneConnectors, setDoneConnectors] = useState(() => buildDoneConnectors(activeIndex));
  const [connectorPhase, setConnectorPhase] = useState<SidebarConnectorPhase | null>(null);
  const [activeConnector, setActiveConnector] = useState<number | null>(null);
  const [bouncingStep, setBouncingStep] = useState<number | null>(null);
  const [poppingStep, setPoppingStep] = useState<number | null>(null);
  const [leavingStep, setLeavingStep] = useState<number | null>(null);
  const visualRef = useRef(activeIndex);
  const runIdRef = useRef(0);

  const applySnap = (index: number) => {
    const snap = applySnapState(index);
    visualRef.current = snap.visualActiveIndex;
    setVisualActiveIndex(snap.visualActiveIndex);
    setDoneConnectors(snap.doneConnectors);
    setConnectorPhase(snap.connectorPhase);
    setActiveConnector(snap.activeConnector);
    setBouncingStep(snap.bouncingStep);
    setPoppingStep(snap.poppingStep);
    setLeavingStep(snap.leavingStep);
  };

  useEffect(() => {
    visualRef.current = visualActiveIndex;
  }, [visualActiveIndex]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      applySnap(activeIndex);
      return;
    }

    const runId = ++runIdRef.current;
    const abort = new AbortController();

    const runScene = async () => {
      try {
        let current = visualRef.current;
        const target = activeIndex;

        if (target === current) {
          setDoneConnectors(buildDoneConnectors(target));
          return;
        }

        if (Math.abs(target - current) > 1) {
          applySnap(target);
          return;
        }

        if (target > current) {
          const connectorIndex = current;
          const nextStep = connectorIndex + 1;

          setLeavingStep(null);
          setPoppingStep(null);
          setActiveConnector(connectorIndex);
          setConnectorPhase("draw");
          await wait(FORWARD_TIMING_MS.draw, abort.signal);
          if (runId !== runIdRef.current) return;

          setConnectorPhase("bubble");
          setBouncingStep(nextStep);
          await wait(FORWARD_TIMING_MS.bubble, abort.signal);
          if (runId !== runIdRef.current) return;

          setBouncingStep(null);
          current = nextStep;
          visualRef.current = current;
          setVisualActiveIndex(current);
          setConnectorPhase("solid");
          await wait(FORWARD_TIMING_MS.solid, abort.signal);
          if (runId !== runIdRef.current) return;

          setConnectorPhase("pulse");
          await wait(FORWARD_TIMING_MS.pulse, abort.signal);
          if (runId !== runIdRef.current) return;

          setDoneConnectors((previous) => {
            const next = new Set(previous);
            next.add(connectorIndex);
            return next;
          });
          setConnectorPhase(null);
          setActiveConnector(null);
          return;
        }

        const stepToPop = current;
        const connectorIndex = current - 1;
        const previousStep = stepToPop - 1;

        setLeavingStep(stepToPop);
        setPoppingStep(stepToPop);
        setBouncingStep(null);
        setConnectorPhase(null);
        setActiveConnector(null);

        const retractStart = wait(BACKWARD_TIMING_MS.retractStart, abort.signal).then(() => {
          if (runId !== runIdRef.current) return;
          setDoneConnectors((previous) => {
            const next = new Set(previous);
            next.delete(connectorIndex);
            return next;
          });
          setActiveConnector(connectorIndex);
          setConnectorPhase("retract");
        });

        const sceneEnd = Math.max(
          BACKWARD_TIMING_MS.pop,
          BACKWARD_TIMING_MS.retractStart + BACKWARD_TIMING_MS.retract
        );

        await Promise.all([wait(BACKWARD_TIMING_MS.pop, abort.signal), retractStart, wait(sceneEnd, abort.signal)]);
        if (runId !== runIdRef.current) return;

        setPoppingStep(null);
        setConnectorPhase(null);
        setActiveConnector(null);
        current = previousStep;
        visualRef.current = current;
        setVisualActiveIndex(current);
        setLeavingStep(null);
      } catch {
        /* aborted — следующий запуск эффекта подхватит актуальный шаг */
      }
    };

    void runScene();

    return () => {
      abort.abort();
    };
  }, [activeIndex]);

  return {
    visualActiveIndex,
    doneConnectors,
    connectorPhase,
    activeConnector,
    bouncingStep,
    poppingStep,
    leavingStep
  };
}
