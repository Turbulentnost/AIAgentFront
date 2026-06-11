import { useEffect, useState } from "react";

const EXPAND_ZONE_PX = 148;

function computeFooterExpandProgress() {
  const scrollTop = window.scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  // Нет прокрутки — компактный футер (верх страницы)
  if (maxScroll <= 8) return 0;

  // Зона раскрытия не больше доступного скролла — иначе «верх» не сжимается до конца
  const zone = Math.min(EXPAND_ZONE_PX, maxScroll);
  const distanceFromBottom = maxScroll - scrollTop;

  if (distanceFromBottom >= zone) return 0;

  const raw = 1 - distanceFromBottom / zone;
  const clamped = Math.min(1, Math.max(0, raw));

  if (clamped < 0.035) return 0;
  if (clamped > 0.965) return 1;
  return clamped;
}

export function useFooterExpandProgress(deps: unknown[] = []) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setProgress(computeFooterExpandProgress());
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);

    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчёт при смене шага / контента
  }, deps);

  return progress;
}
