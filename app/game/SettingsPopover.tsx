'use client';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** Reading settings pauses biological play; closing never silently resumes it. */
export function SettingsPopover({
  label,
  className = '',
  onOpen,
  children,
}: {
  label: string;
  className?: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const opened = useRef(onOpen);
  useEffect(() => {
    opened.current = onOpen;
  });
  useEffect(() => {
    const el = details.current;
    if (!el) return;
    const toggle = () => {
      if (!el.open) return;
      for (const other of document.querySelectorAll<HTMLDetailsElement>(
        'details[data-game-settings]',
      ))
        if (other !== el) other.open = false;
      opened.current?.();
    };
    const escape = (event: KeyboardEvent) => {
      if (!el.open || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      el.open = false;
      el.querySelector('summary')?.focus();
    };
    const outside = (event: Event) => {
      if (el.open && event.target instanceof Node && !el.contains(event.target))
        el.open = false;
    };
    el.addEventListener('toggle', toggle);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('click', outside);
    // Native disclosure state can be restored by the browser on reload.
    if (el.open) toggle();
    return () => {
      el.removeEventListener('toggle', toggle);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('click', outside);
    };
  }, []);
  return (
    <details
      ref={details}
      data-game-settings
      className={`controls-help ${className}`}
      suppressHydrationWarning
    >
      <summary>{label}</summary>
      <div className="controls-help-card">
        {children}
        {onOpen && (
          <small className="settings-paused">
            打开面板时暂停 · 关闭后点“继续探索”
          </small>
        )}
        <small>Esc 关闭，也可点击面板外。</small>
      </div>
    </details>
  );
}
