window.__ModuleLoader__.load({
  id: "dsh-pixel-studio",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const h = React.createElement;

    const CSS = `
.ps-card {
  --ps-border: var(--dsw-alias-border-l1, #2b3140);
  --ps-bg: var(--dsw-alias-bg-layer-1, #151922);
  --ps-bg-soft: var(--dsw-alias-bg-layer-2, #1b202b);
  --ps-text: var(--dsw-alias-label-primary, #e8ecf4);
  --ps-muted: var(--dsw-alias-label-tertiary, #8c97ab);
  --ps-accent: var(--dsw-alias-state-business-primary, #ffcd75);
  border: 1px solid var(--ps-border);
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--ps-bg);
  overflow: hidden;
  margin: 2px 0;
}
.ps-head { display: flex; min-height: 34px; }
.ps-headBtn {
  appearance: none;
  border: 0;
  background: linear-gradient(180deg, #ffffff08, transparent);
  color: var(--ps-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
  padding: 6px 9px;
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px));
  text-align: left;
}
.ps-headBtn:hover { background: var(--dsw-alias-interactive-bg-hover-solid, #ffffff0a); }
.ps-headBtn:focus-visible { outline: 1px solid var(--dsw-focus-ring-color, #73eff7); outline-offset: -1px; }
.ps-icon {
  width: 16px; height: 16px; flex: none; color: var(--ps-accent);
  display: inline-flex; align-items: center; justify-content: center;
}
.ps-icon svg { width: 14px; height: 14px; display: block; }
.ps-title { flex: none; color: var(--ps-text); font-weight: 600; }
.ps-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ps-text); }
.ps-name::before { content: "·"; color: var(--ps-muted); margin-right: 6px; }
.ps-meta { flex: none; margin-left: auto; color: var(--ps-muted); font-size: 11px; white-space: nowrap; }
.ps-score { flex: none; color: var(--ps-muted); font-variant-numeric: tabular-nums; font-size: 11px; }
.ps-score[data-good="true"] { color: #7fcf9a; }
.ps-chevron { flex: none; color: var(--ps-muted); transition: transform .12s ease; font-size: 15px; line-height: 1; }
.ps-chevron[data-open="true"] { transform: rotate(90deg); }
.ps-body { padding: 9px; border-top: 1px solid var(--ps-border); }
.ps-stage {
  display: grid;
  place-items: center;
  min-height: 140px;
  max-height: 460px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--ps-border);
  border-radius: 9px;
  background-color: #202634;
  background-image:
    linear-gradient(45deg, #2a3241 25%, transparent 25%),
    linear-gradient(-45deg, #2a3241 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a3241 75%),
    linear-gradient(-45deg, transparent 75%, #2a3241 75%);
  background-size: 18px 18px;
  background-position: 0 0, 0 9px, 9px -9px, -9px 0;
}
.ps-stage[data-bg="dark"] { background-image: none; background-color: #0d1017; }
.ps-stage[data-bg="light"] { background-image: none; background-color: #f2f5fa; }
.ps-canvas {
  display: block;
  max-width: 100%;
  height: auto !important;
  image-rendering: pixelated;
  cursor: pointer;
  box-shadow: 0 8px 28px #00000030;
}
.ps-controls, .ps-files, .ps-palette {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px;
}
.ps-btn {
  appearance: none;
  border: 1px solid var(--ps-border);
  border-radius: 6px;
  background: var(--ps-bg-soft);
  color: var(--ps-text);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  line-height: 22px;
  padding: 0 8px;
  transition: background .12s ease, border-color .12s ease;
}
.ps-btn:hover { background: var(--dsw-alias-interactive-bg-hover-solid, #222a3a); border-color: var(--dsw-alias-border-l2, #3a455c); }
.ps-btn:focus-visible { outline: 1px solid var(--dsw-focus-ring-color, #73eff7); outline-offset: 1px; }
.ps-btn[disabled] { cursor: default; opacity: .4; }
.ps-btn[data-primary="true"] { background: var(--ps-accent); border-color: var(--ps-accent); color: #221a08; font-weight: 650; }
.ps-field { display: inline-flex; align-items: center; gap: 4px; color: var(--ps-muted); font-size: 11px; white-space: nowrap; }
.ps-range { width: 64px; accent-color: var(--ps-accent); }
.ps-frame { color: var(--ps-muted); font-size: 11px; min-width: 52px; font-variant-numeric: tabular-nums; }
.ps-spacer { flex: 1; }
.ps-chip { width: 14px; height: 14px; border: 1px solid #ffffff22; border-radius: 3px; display: inline-block; }
.ps-note { color: var(--ps-muted); font-size: 11px; line-height: 1.5; }
.ps-error { color: var(--dsw-alias-state-error-primary, #ff7a7a); font-size: 12px; line-height: 1.55; padding: 6px 2px; }
.ps-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--ps-muted); font-size: 12px; padding: 18px; text-align: center; }
.ps-skeleton {
  height: 120px; border-radius: 8px; border: 1px solid var(--ps-border);
  background: linear-gradient(100deg, #ffffff05 20%, #ffffff10 40%, #ffffff05 60%);
  background-size: 200% 100%;
  animation: ps-shimmer 1.3s linear infinite;
}
@keyframes ps-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .ps-chevron, .ps-btn { transition: none; }
  .ps-skeleton { animation: none; }
}
@media (max-width: 560px) {
  .ps-meta { display: none; }
  .ps-score { margin-left: auto; }
}
`;
    const cssId = "dsh-pixel-studio/client.css";
    if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${cssId}"]`) === null) {
      const style = document.createElement("style");
      style.dataset.plugin = "dsh-pixel-studio";
      style.dataset.pluginCss = cssId;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
    const locale = String(
      (typeof document !== "undefined" && document.documentElement && document.documentElement.lang)
      || (typeof navigator !== "undefined" && navigator.language)
      || "en",
    ).toLowerCase();
    const zh = locale.startsWith("zh");
    const L = zh ? {
      art: "像素画",
      animation: "像素动画",
      drawing: "正在绘制像素画…",
      play: "播放",
      pause: "暂停",
      prev: "上一帧",
      next: "下一帧",
      frames: "帧",
      frame: "帧",
      grid: "网格",
      onion: "洋葱皮",
      zoom: "缩放",
      background: "背景",
      open: "打开",
      png: "PNG",
      gif: "GIF",
      sheet: "精灵表",
      oypx: "OYPX",
      html: "HTML",
      still: "静态",
      craft: "Craft",
      unavailable: "内嵌画布不可用",
      failed: "工具执行失败",
      noCanvas: "作品过大或颜色过多，无法内嵌；可打开导出的 PNG/GIF。",
      openFiles: "打开文件",
    } : {
      art: "Pixel art",
      animation: "Pixel animation",
      drawing: "Painting pixel art…",
      play: "Play",
      pause: "Pause",
      prev: "Previous frame",
      next: "Next frame",
      frames: "frames",
      frame: "Frame",
      grid: "Grid",
      onion: "Onion",
      zoom: "Zoom",
      background: "Background",
      open: "Open",
      png: "PNG",
      gif: "GIF",
      sheet: "Sheet",
      oypx: "OYPX",
      html: "HTML",
      still: "Still",
      craft: "Craft",
      unavailable: "Inline canvas unavailable",
      failed: "Tool failed",
      noCanvas: "The artwork is too large or has too many colours to inline; open the exported PNG/GIF.",
      openFiles: "Open files",
    };

    function parseColor(value) {
      const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(value || ""));
      if (!match) return [0, 0, 0, 0];
      const rgb = match[1];
      return [
        Number.parseInt(rgb.slice(0, 2), 16),
        Number.parseInt(rgb.slice(2, 4), 16),
        Number.parseInt(rgb.slice(4, 6), 16),
        match[2] === undefined ? 255 : Number.parseInt(match[2], 16),
      ];
    }

    function initialZoom(canvas) {
      if (!canvas || !canvas.width || !canvas.height) return 8;
      return Math.max(1, Math.min(12, Math.floor(360 / Math.max(canvas.width, canvas.height))));
    }

    function buildFrameCanvases(canvas) {
      if (!canvas || !canvas.available || typeof document === "undefined") return [];
      const colors = (canvas.colors || []).map(parseColor);
      return (canvas.frames || []).map((frame) => {
        const image = document.createElement("canvas");
        image.width = canvas.width;
        image.height = canvas.height;
        const context = image.getContext("2d");
        if (context === null) return image;
        const data = context.createImageData(canvas.width, canvas.height);
        for (let y = 0; y < canvas.height; y += 1) {
          const row = frame.rows[y] || "";
          for (let x = 0; x < canvas.width; x += 1) {
            const symbol = row[x] || ".";
            if (symbol === ".") continue;
            const index = SYMBOLS.indexOf(symbol);
            if (index < 0 || index >= colors.length) continue;
            const color = colors[index];
            const offset = (y * canvas.width + x) * 4;
            data.data[offset] = color[0];
            data.data[offset + 1] = color[1];
            data.data[offset + 2] = color[2];
            data.data[offset + 3] = color[3];
          }
        }
        context.putImageData(data, 0, 0);
        return image;
      });
    }

    const PixelIcon = () => h("svg", { viewBox: "0 0 16 16", "aria-hidden": "true" },
      h("rect", { x: 1, y: 1, width: 6, height: 6, rx: 1, fill: "currentColor" }),
      h("rect", { x: 9, y: 3, width: 6, height: 6, rx: 1, fill: "currentColor", opacity: 0.8 }),
      h("rect", { x: 3, y: 9, width: 6, height: 6, rx: 1, fill: "currentColor", opacity: 0.8 }),
      h("rect", { x: 11, y: 11, width: 3, height: 3, rx: 0.5, fill: "currentColor", opacity: 0.5 }),
    );

    function frameSummary(meta) {
      if (!meta) return "";
      const bits = [`${meta.width}×${meta.height}`];
      if (meta.frameCount > 1) {
        bits.push(`${meta.frameCount} ${L.frames}`);
        if (meta.fps) bits.push(`${meta.fps} fps`);
      }
      const colors = meta.canvas && meta.canvas.available
        ? meta.canvas.colors.length
        : (meta.palette && meta.palette.colors ? meta.palette.colors.length : 0);
      if (colors) bits.push(`${colors} colors`);
      return bits.join(" · ");
    }

    function PixelToolView(props) {
      const { phase, block, openFile } = props;
      const result = phase === "result" ? block : null;
      const meta = result && result.meta && typeof result.meta === "object" ? result.meta : null;
      const canvasMeta = meta && meta.canvas && meta.canvas.available ? meta.canvas : null;
      const frameCount = canvasMeta && Array.isArray(canvasMeta.frames) ? canvasMeta.frames.length : 0;
      const [open, setOpen] = React.useState(true);
      const [index, setIndex] = React.useState(0);
      const [playing, setPlaying] = React.useState(false);
      const [zoom, setZoom] = React.useState(() => initialZoom(canvasMeta));
      const [grid, setGrid] = React.useState(false);
      const [onion, setOnion] = React.useState(false);
      const [bg, setBg] = React.useState("checker");
      const canvasRef = React.useRef(null);
      const frameCanvases = React.useMemo(() => buildFrameCanvases(canvasMeta), [canvasMeta]);
      const reduced = typeof window !== "undefined" && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      React.useEffect(() => {
        setIndex(0);
        setPlaying(frameCount > 1 && !reduced);
        setZoom(initialZoom(canvasMeta));
      }, [canvasMeta, frameCount, reduced]);

      React.useEffect(() => {
        if (!playing || frameCount < 2) return undefined;
        const duration = Math.max(20, canvasMeta?.frames[index]?.durationMs || 100);
        const timer = setTimeout(() => setIndex((current) => (current + 1) % frameCount), duration);
        return () => clearTimeout(timer);
      }, [playing, index, frameCount, canvasMeta]);

      React.useEffect(() => {
        if (!canvasMeta || !canvasRef.current || frameCanvases.length === 0) return;
        const element = canvasRef.current;
        const context = element.getContext("2d");
        if (context === null) return;
        const w = canvasMeta.width;
        const h = canvasMeta.height;
        element.width = w * zoom;
        element.height = h * zoom;
        element.style.width = `${w * zoom}px`;
        element.style.height = `${h * zoom}px`;
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, element.width, element.height);
        if (onion && frameCount > 1) {
          context.globalAlpha = 0.22;
          context.drawImage(frameCanvases[(index - 1 + frameCount) % frameCount], 0, 0, w * zoom, h * zoom);
          context.globalAlpha = 1;
        }
        context.drawImage(frameCanvases[index] || frameCanvases[0], 0, 0, w * zoom, h * zoom);
        if (grid && zoom >= 6) {
          context.save();
          context.globalAlpha = 0.18;
          context.strokeStyle = "#ffffff";
          context.lineWidth = 1;
          for (let x = 1; x < w; x += 1) {
            context.beginPath();
            context.moveTo(x * zoom + 0.5, 0);
            context.lineTo(x * zoom + 0.5, element.height);
            context.stroke();
          }
          for (let y = 1; y < h; y += 1) {
            context.beginPath();
            context.moveTo(0, y * zoom + 0.5);
            context.lineTo(element.width, y * zoom + 0.5);
            context.stroke();
          }
          context.restore();
        }
      }, [canvasMeta, frameCanvases, index, zoom, grid, onion, frameCount, open]);

      const title = result
        ? (meta && meta.kind === "animation" ? L.animation : L.art)
        : L.drawing;
      const name = meta ? meta.name : (block && block.args && block.args.name) || "";
      const summary = frameSummary(meta);
      const score = meta && meta.craft ? meta.craft.score : null;
      const errorMessage = result && result.isError
        ? (result.error && (result.error.message || result.error.code)) || "Unknown error"
        : null;
      const canOpen = typeof openFile === "function";
      const openFileSafe = (path) => {
        if (canOpen && path) openFile(path);
      };

      const files = meta ? [
        ["png", meta.imagePath],
        ["gif", meta.gifPath],
        ["sheet", meta.sheetPath],
        ["oypx", meta.oypxPath],
        ["html", meta.viewerPath],
      ].filter((entry) => Boolean(entry[1])) : [];

      const palette = meta && meta.canvas && meta.canvas.available
        ? meta.canvas.colors
        : (meta && meta.palette && meta.palette.colors) || [];

      const body = !open ? null : h("div", { className: "ps-body" },
        errorMessage
          ? h("div", { className: "ps-error" }, `${L.failed}: ${errorMessage}`)
          : phase !== "result"
            ? h("div", { className: "ps-skeleton", "aria-label": L.drawing })
            : !canvasMeta
              ? h("div", { className: "ps-empty" },
                h("div", null, L.unavailable),
                h("div", { className: "ps-note" }, (meta && meta.canvas && meta.canvas.reason) || L.noCanvas),
                canOpen && files.length > 0 && h("div", { className: "ps-files" }, files.map(([label, path]) =>
                  h("button", { key: label, type: "button", className: "ps-btn", onClick: () => openFileSafe(path) }, L[label] || label)
                ))
              )
              : h(React.Fragment, null,
                h("div", { className: "ps-stage", "data-bg": bg },
                  h("canvas", {
                    ref: canvasRef,
                    className: "ps-canvas",
                    onClick: () => {
                      if (frameCount > 1) setPlaying((value) => !value);
                    },
                    "aria-label": `${meta.name} ${L.art}`,
                  })
                ),
                h("div", { className: "ps-controls" },
                  h("button", {
                    type: "button",
                    className: "ps-btn",
                    "data-primary": "true",
                    disabled: frameCount < 2,
                    onClick: () => setPlaying((value) => !value),
                  }, playing ? L.pause : L.play),
                  h("button", { type: "button", className: "ps-btn", disabled: frameCount < 2, onClick: () => { setPlaying(false); setIndex((current) => (current - 1 + frameCount) % frameCount); }, "aria-label": L.prev }, "‹"),
                  h("button", { type: "button", className: "ps-btn", disabled: frameCount < 2, onClick: () => { setPlaying(false); setIndex((current) => (current + 1) % frameCount); }, "aria-label": L.next }, "›"),
                  h("span", { className: "ps-frame" }, frameCount > 1 ? `${index + 1} / ${frameCount}` : L.still),
                  h("span", { className: "ps-spacer" }),
                  h("label", { className: "ps-field" }, L.zoom,
                    h("input", {
                      className: "ps-range",
                      type: "range",
                      min: 1,
                      max: 24,
                      step: 1,
                      value: zoom,
                      onChange: (event) => setZoom(Number(event.target.value)),
                      "aria-label": L.zoom,
                    })
                  ),
                  h("label", { className: "ps-field" },
                    h("input", { type: "checkbox", checked: grid, onChange: (event) => setGrid(event.target.checked) }),
                    L.grid
                  ),
                  frameCount > 1 && h("label", { className: "ps-field" },
                    h("input", { type: "checkbox", checked: onion, onChange: (event) => setOnion(event.target.checked) }),
                    L.onion
                  )
                ),
                h("div", { className: "ps-palette" },
                  palette.slice(0, 16).map((hex, colorIndex) =>
                    h("span", { key: `${hex}-${colorIndex}`, className: "ps-chip", style: { background: hex }, title: hex })
                  ),
                  palette.length > 16 && h("span", { className: "ps-note" }, `+${palette.length - 16}`),
                  h("span", { className: "ps-spacer" }),
                  h("label", { className: "ps-field" }, L.background,
                    h("select", {
                      className: "ps-btn",
                      value: bg,
                      onChange: (event) => setBg(event.target.value),
                      "aria-label": L.background,
                    },
                      h("option", { value: "checker" }, "Checker"),
                      h("option", { value: "dark" }, "Dark"),
                      h("option", { value: "light" }, "Light")
                    )
                  )
                ),
                canOpen && files.length > 0 && h("div", { className: "ps-files" },
                  h("span", { className: "ps-note" }, L.openFiles),
                  files.map(([label, path]) =>
                    h("button", { key: label, type: "button", className: "ps-btn", onClick: () => openFileSafe(path) }, L[label] || label)
                  )
                )
              )
      );

      return h("div", { className: "ps-card", "data-tool": props.toolName || "pixel" },
        h("div", { className: "ps-head" },
          h("button", {
            type: "button",
            className: "ps-headBtn",
            onClick: () => setOpen((value) => !value),
            "aria-expanded": open,
          },
            h("span", { className: "ps-icon" }, h(PixelIcon)),
            h("span", { className: "ps-title" }, title),
            name ? h("span", { className: "ps-name" }, name) : null,
            summary ? h("span", { className: "ps-meta" }, summary) : null,
            score !== null ? h("span", { className: "ps-score", "data-good": score >= 95 ? "true" : "false" }, `${L.craft} ${score}`) : null,
            h("span", { className: "ps-chevron", "data-open": open ? "true" : "false" }, "›")
          )
        ),
        body
      );
    }

    function apply(ctx) {
      ctx.slots.inject("tool.call.toolview", function* () {
        yield ctx.slots.register({
          name: "tool.call.toolview",
          key: "pixel_art",
        }, PixelToolView);
        yield ctx.slots.register({
          name: "tool.call.toolview",
          key: "pixel_animation",
        }, PixelToolView);
      });
    }

    const inject = ["slots"];
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
