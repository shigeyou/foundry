"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface MermaidFlowchartProps {
  code: string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
  /** Height in px. Default 500 */
  height?: number;
  /** Hide zoom controls for compact display */
  compact?: boolean;
  /** Label shown above the chart */
  label?: string;
  /** Label color class */
  labelColor?: string;
}

export function MermaidFlowchart({
  code,
  onNodeClick,
  className,
  height = 500,
  compact = false,
  label,
  labelColor,
}: MermaidFlowchartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Watch for dark mode changes to re-render mermaid
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          flowchart: {
            useMaxWidth: false,
            htmlLabels: true,
            curve: "basis",
            nodeSpacing: 30,
            rankSpacing: 60,
            padding: 20,
          },
          themeVariables: {
            fontSize: "14px",
            fontFamily: "system-ui, sans-serif",
          },
          securityLevel: "loose",
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Mermaid render error");
          setSvg("");
        }
      }
    }

    renderMermaid();
    return () => { cancelled = true; };
  }, [code, isDark]);

  // Auto-fit on render
  const fitToView = useCallback(() => {
    if (!viewportRef.current) return;
    const svgEl = viewportRef.current.querySelector("svg");
    if (!svgEl) return;

    const svgRect = svgEl.getBoundingClientRect();
    const vpW = viewportRef.current.clientWidth;
    const vpH = viewportRef.current.clientHeight;
    // Get natural SVG size (at current scale)
    const naturalW = svgRect.width / scale;
    const naturalH = svgRect.height / scale;
    if (naturalW > 0 && vpW > 0) {
      const fitScale = Math.min(vpW / naturalW, vpH / naturalH, 1) * 0.95;
      const newScale = Math.max(fitScale, 0.15);
      // Center the content
      const scaledW = naturalW * newScale;
      const scaledH = naturalH * newScale;
      setPan({
        x: Math.max(0, (vpW - scaledW) / 2),
        y: Math.max(0, (vpH - scaledH) / 2),
      });
      setScale(newScale);
    }
  }, [scale]);

  // Auto-fit on first SVG render
  useEffect(() => {
    if (!svg || !viewportRef.current) return;
    // Wait for DOM update
    requestAnimationFrame(() => {
      if (!viewportRef.current) return;
      const svgEl = viewportRef.current.querySelector("svg");
      if (!svgEl) return;
      const svgRect = svgEl.getBoundingClientRect();
      const vpW = viewportRef.current.clientWidth;
      const vpH = viewportRef.current.clientHeight;
      if (svgRect.width > 0 && vpW > 0) {
        const fitScale = Math.min(vpW / svgRect.width, vpH / svgRect.height, 1) * 0.95;
        const newScale = Math.max(fitScale, 0.15);
        const scaledW = svgRect.width * newScale;
        const scaledH = svgRect.height * newScale;
        setPan({
          x: Math.max(0, (vpW - scaledW) / 2),
          y: Math.max(0, (vpH - scaledH) / 2),
        });
        setScale(newScale);
      }
    });
  }, [svg]);

  const zoom = useCallback((delta: number) => {
    setScale((s) => Math.min(Math.max(s + delta, 0.15), 2.5));
  }, []);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  // Re-fit when entering/exiting fullscreen
  useEffect(() => {
    if (!svg || !viewportRef.current) return;
    // Wait for layout to update after fullscreen toggle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitToView();
      });
    });
  }, [fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse drag to pan (no scrollbars)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Wheel: zoom (no modifier needed), or pan with shift
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setScale((s) => Math.min(Math.max(s + delta, 0.15), 2.5));
    } else {
      // Pan
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  // Click handler for nodes
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onNodeClick) return;
    // Skip if was dragging
    const target = e.target as HTMLElement;
    let el: HTMLElement | null = target;
    while (el && el !== containerRef.current) {
      if (el.classList?.contains("node")) {
        const nodeId = el.id?.replace(/^flowchart-/, "").replace(/-\d+$/, "");
        if (nodeId) {
          onNodeClick(nodeId);
          return;
        }
      }
      el = el.parentElement;
    }
  }, [onNodeClick]);

  if (error) {
    return (
      <div className={`p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${className || ""}`}>
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">フローチャートの描画エラー</p>
        <pre className="text-xs text-red-500 mt-2 whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`flex items-center justify-center p-8 ${className || ""}`}>
        <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  const fullscreenButton = (
    <button
      onClick={() => setFullscreen((f) => !f)}
      className={`${compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs"} bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded`}
      title={fullscreen ? "全画面を終了 (Esc)" : "全画面表示"}
    >
      {fullscreen ? (
        <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4" />
        </svg>
      ) : (
        <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
      )}
    </button>
  );

  const controlBar = (
    <div className="flex items-center gap-1 mb-1">
      {label && (
        <span className={`text-xs font-semibold mr-2 ${labelColor || "text-slate-600 dark:text-slate-300"}`}>
          {label}
        </span>
      )}
      {!compact && (
        <>
          <button onClick={() => zoom(0.15)} className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded font-mono" title="ズームイン">+</button>
          <button onClick={() => zoom(-0.15)} className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded font-mono" title="ズームアウト">-</button>
          <button onClick={fitToView} className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded" title="全体表示">全体</button>
          <span className="text-xs text-slate-400 ml-1">{Math.round(scale * 100)}%</span>
        </>
      )}
      {compact && (
        <>
          <button onClick={() => zoom(0.15)} className="px-1 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded font-mono">+</button>
          <button onClick={() => zoom(-0.15)} className="px-1 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded font-mono">-</button>
          <button onClick={fitToView} className="px-1 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">全体</button>
        </>
      )}
      {fullscreenButton}
      {fullscreen && (
        <span className="text-xs text-slate-400 ml-auto">Escで終了</span>
      )}
    </div>
  );

  const canvas = (
    <div
      ref={viewportRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
      className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 select-none"
      style={{
        height: fullscreen ? "calc(100vh - 48px)" : `${height}px`,
        cursor: dragRef.current ? "grabbing" : "grab",
      }}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "top left",
          display: "inline-block",
          willChange: "transform",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );

  if (fullscreen) {
    return (
      <>
        {/* Placeholder to preserve layout */}
        <div className={className || ""} style={{ height: `${height + 30}px` }} />
        {/* Fullscreen overlay */}
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 p-2">
          <div ref={containerRef} className="h-full">
            {controlBar}
            {canvas}
          </div>
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className={className || ""}>
      {controlBar}
      {canvas}
    </div>
  );
}
