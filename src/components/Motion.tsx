"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Memunculkan elemen dengan animasi saat masuk layar. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

/** Teks yang diketik lalu dihapus, bergantian antar contoh. */
export function Typer({ items }: { items: string[] }) {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0;
    let n = 0;
    let deleting = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = items[i];
      n += deleting ? -1 : 1;
      setText(word.slice(0, n));
      let wait = deleting ? 35 : 75;
      if (!deleting && n === word.length) {
        deleting = true;
        wait = 1800;
      } else if (deleting && n === 0) {
        deleting = false;
        i = (i + 1) % items.length;
        wait = 400;
      }
      t = setTimeout(tick, wait);
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [items]);
  return (
    <span>
      {text}
      <span className="caret" />
    </span>
  );
}

/** Angka yang berhitung naik saat terlihat. */
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const step = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return (
    <b ref={ref}>
      {val}
      {suffix}
    </b>
  );
}
