"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface MermaidFlowchartProps {
  code: string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export function MermaidFlowchart({ code, onNodeClick, className }: MermaidFlowchartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
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

        const id = `mermaid-${Date.now()}`;
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
  }, [code]);

  // Auto-fit on first render
  useEffect(() => {
    if (!svg || !viewportRef.current) return;
    const svgEl = viewportRef.current.querySelector("svg");
    if (!svgEl) return;

    const svgW = svgEl.getBoundingClientRect().width;
    const containerW = viewportRef.current.clientWidth;
    if (svgW > 0 && containerW > 0) {
      const fitScale = Math.min(containerW / svgW, 1);
      setScale(Math.max(fitScale, 0.3));
    }
  }, [svg]);

  const zoom = useCallback((delta: number) => {
    setScale((s) => Math.min(Math.max(s + delta, 0.2), 2));
  }, []);

  const fitToView = useCallback(() => {
    if (!viewportRef.current) return;
    const svgEl = viewportRef.current.querySelector("svg");
    if (!svgEl) return;
    // Reset scale to 1 temporarily to get natural size
    setScale(1);
    requestAnimationFrame(() => {
      if (!viewportRef.current) return;
      const svgW = svgEl.getBoundingClientRect().width;
      const svgH = svgEl.getBoundingClientRect().height;
      const containerW = viewportRef.current.clientWidth;
      const containerH = viewportRef.current.clientHeight;
      if (svgW > 0 && containerW > 0) {
        const fitScale = Math.min(containerW / svgW, containerH / svgH, 1);
        setScale(Math.max(fitScale, 0.2));
      }
    });
  }, []);

  // Mouse drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const vp = viewportRef.current;
    if (!vp) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({ x: vp.scrollLeft, y: vp.scrollTop });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !viewportRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    viewportRef.current.scrollLeft = scrollStart.x - dx;
    viewportRef.current.scrollTop = scrollStart.y - dy;
  }, [isDragging, dragStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.min(Math.max(s + delta, 0.2), 2));
    }
  }, []);

  // Click handler for nodes
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onNodeClick) return;
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
        <pre className="text-xs text-red-500 mt-2 overflow-auto">{error}</pre>
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

  return (
    <div ref={containerRef} className={className || ""}>
      {/* Zoom controls */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => zoom(0.15)}
          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors font-mono"
          title="ズームイン"
        >
          +
        </button>
        <button
          onClick={() => zoom(-0.15)}
          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors font-mono"
          title="ズームアウト"
        >
          -
        </button>
        <button
          onClick={fitToView}
          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
          title="全体表示"
        >
          全体
        </button>
        <span className="text-xs text-slate-400 ml-1">{Math.round(scale * 100)}%</span>
        <span className="text-xs text-slate-400 ml-auto">Ctrl+ホイールでズーム / ドラッグで移動</span>
      </div>

      {/* Scrollable viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
        style={{
          height: "500px",
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            display: "inline-block",
            padding: "20px",
            minWidth: "100%",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
