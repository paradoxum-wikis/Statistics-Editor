// offset* ignores ancestor transforms (dialog scale-in skews getBoundingClientRect).
function offsetLeftWithin(el: HTMLElement, container: HTMLElement): number | null {
  let left = 0;
  let current: HTMLElement | null = el;
  while (current && current !== container) {
    left += current.offsetLeft;
    const parent = current.offsetParent as HTMLElement | null;
    if (parent === container) return left;
    if (!parent || !container.contains(parent)) break;
    current = parent;
  }
  return current === container ? left : null;
}

export function tabPill(node: HTMLElement, getActiveKey: () => unknown) {
  let ready = false;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  let raf = 0;

  function measure() {
    const active = node.querySelector<HTMLElement>(
      '[data-state="active"], .active',
    );
    if (!active) {
      node.style.setProperty("--pill-left", "3px");
      node.style.setProperty("--pill-width", "0px");
      return;
    }

    const offsetLeft = offsetLeftWithin(active, node);
    if (offsetLeft != null) {
      node.style.setProperty("--pill-left", `${offsetLeft}px`);
      node.style.setProperty("--pill-width", `${active.offsetWidth}px`);
    } else {
      const lr = node.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      const borderLeft =
        parseFloat(getComputedStyle(node).borderLeftWidth) || 0;
      const scaleX = lr.width ? node.offsetWidth / lr.width : 1;
      node.style.setProperty(
        "--pill-left",
        `${(ar.left - lr.left) * scaleX - borderLeft}px`,
      );
      node.style.setProperty("--pill-width", `${ar.width * scaleX}px`);
    }

    if (!ready)
      queueMicrotask(() => node.style.setProperty("--pill-ready", "1"));
    ready = true;
  }

  function measureSoon() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      measure();
      raf = requestAnimationFrame(measure);
    });
  }

  function onScroll() {
    node.style.setProperty("--pill-ready", "0");
    measure();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      node.style.setProperty("--pill-ready", "1");
    }, 120);
  }

  $effect(() => {
    getActiveKey();
    measure();
    measureSoon();
  });

  const ro = new ResizeObserver(measure);
  ro.observe(node);
  for (const child of node.querySelectorAll<HTMLElement>(
    ".tabs-trigger, [role='tab']",
  )) {
    ro.observe(child);
  }
  node.addEventListener("scroll", onScroll, { passive: true });

  return {
    destroy() {
      ro.disconnect();
      node.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimer);
      cancelAnimationFrame(raf);
    },
  };
}
