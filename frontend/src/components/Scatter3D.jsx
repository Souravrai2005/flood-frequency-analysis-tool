import { useEffect, useMemo, useRef, useState } from "react";

const TYPE_COLORS = {
  "P-V type": "#2c7a86",
  "V-D type": "#0b1f33",
  "P-D type": "#c4a574",
  "Extreme event": "#8b3a32",
  "Low-intensity event": "#6b8f71",
  Other: "#5c6773",
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return values.map(() => 0);
  }
  return values.map((value) => (2 * (value - min)) / (max - min) - 1);
}

function project(x, y, z, rotX, rotY) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;
  const y1 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;
  const perspective = 2.6;
  const scale = perspective / (perspective + z2);
  return { x: x1 * scale, y: y1 * scale, z: z2, scale };
}

export default function Scatter3D({ events = [] }) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ x: -0.55, y: 0.7 });
  const dragRef = useRef(null);

  const points = useMemo(() => {
    const prepared = events
      .map((event) => ({
        x: toNumber(event.Peakvalue),
        y: toNumber(event.Volume),
        z: toNumber(event.Duration),
        type: event.Flood_Type || "Other",
      }))
      .filter((event) => event.x != null && event.y != null && event.z != null);
    if (!prepared.length) {
      return [];
    }
    const nx = normalize(prepared.map((event) => event.x));
    const ny = normalize(prepared.map((event) => event.y));
    const nz = normalize(prepared.map((event) => event.z));
    return prepared.map((event, index) => ({
      ...event,
      nx: nx[index],
      ny: ny[index],
      nz: nz[index],
    }));
  }, [events]);

  const types = useMemo(() => {
    const present = new Set(points.map((point) => point.type));
    return Object.keys(TYPE_COLORS).filter((type) => present.has(type));
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) {
      return undefined;
    }

    function draw() {
      const ctx = canvas.getContext("2d");
      const width = canvas.clientWidth || 640;
      const height = canvas.clientHeight || 420;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2 + 8;
      const size = Math.min(width, height) * 0.38;

      function toScreen(x, y, z) {
        const projected = project(x, y, z, rotation.x, rotation.y);
        return {
          x: cx + projected.x * size,
          y: cy - projected.y * size,
          z: projected.z,
          scale: projected.scale,
        };
      }

      const axis = [
        { from: [-1.15, -1.15, -1.15], to: [1.2, -1.15, -1.15], label: "Peak Discharge", color: "#1f5c66" },
        { from: [-1.15, -1.15, -1.15], to: [-1.15, 1.2, -1.15], label: "Flood Volume", color: "#0b1f33" },
        { from: [-1.15, -1.15, -1.15], to: [-1.15, -1.15, 1.2], label: "Flood Duration", color: "#8a6a3b" },
      ];

      ctx.lineWidth = 1.4;
      axis.forEach((item) => {
        const start = toScreen(...item.from);
        const end = toScreen(...item.to);
        ctx.strokeStyle = item.color;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.fillStyle = item.color;
        ctx.font = "12px 'IBM Plex Sans', sans-serif";
        ctx.fillText(item.label, end.x + 6, end.y);
      });

      const drawn = points
        .map((point) => ({
          ...point,
          screen: toScreen(point.nx, point.ny, point.nz),
        }))
        .sort((a, b) => a.screen.z - b.screen.z);

      drawn.forEach((point) => {
        const radius = 4.2 * point.screen.scale;
        ctx.beginPath();
        ctx.fillStyle = TYPE_COLORS[point.type] || TYPE_COLORS.Other;
        ctx.strokeStyle = "rgba(255,252,247,0.9)";
        ctx.lineWidth = 0.8;
        ctx.arc(point.screen.x, point.screen.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, rotation]);

  function onPointerDown(event) {
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotX: rotation.x,
      rotY: rotation.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragRef.current) {
      return;
    }
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setRotation({
      x: dragRef.current.rotX + dy * 0.01,
      y: dragRef.current.rotY + dx * 0.01,
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  if (!points.length) {
    return null;
  }

  return (
    <div className="scatter3d">
      <canvas
        ref={canvasRef}
        className="scatter3d-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div className="scatter3d-legend">
        {types.map((type) => (
          <span key={type}>
            <i style={{ background: TYPE_COLORS[type] }} />
            {type}
          </span>
        ))}
      </div>
      <p className="scatter3d-hint">
        Drag to rotate. X = Peak Discharge, Y = Flood Volume, Z = Flood
        Duration. Point coordinates are the classified events returned by the
        analysis service.
      </p>
    </div>
  );
}
