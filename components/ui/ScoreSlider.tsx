"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface ScoreSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

export function ScoreSlider({
  value,
  min = 1,
  max = 5,
  step = 0.5,
  onChange,
}: ScoreSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const valueToPercent = (val: number) => ((val - min) / (max - min)) * 100;

  const percentToValue = useCallback(
    (percent: number) => {
      const rawValue = (percent / 100) * (max - min) + min;
      const stepped = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step]
  );

  const getValueFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      return percentToValue(percent);
    },
    [percentToValue, value]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      onChange(getValueFromEvent(e.clientX));
    },
    [getValueFromEvent, onChange]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      onChange(getValueFromEvent(e.clientX));
    },
    [isDragging, getValueFromEvent, onChange]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      onChange(getValueFromEvent(e.touches[0].clientX));
    },
    [getValueFromEvent, onChange]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      onChange(getValueFromEvent(e.touches[0].clientX));
    },
    [isDragging, getValueFromEvent, onChange]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  const percent = valueToPercent(value);

  return (
    <div className="select-none pt-8 pb-1">
      <div
        ref={trackRef}
        className="relative h-5 cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* トラック背景（グレー） */}
        <div
          className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full"
          style={{ background: "#d1d5db" }}
        />
        {/* トラック塗りつぶし（青） */}
        <div
          className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full"
          style={{ width: `${percent}%`, background: "#1e40af" }}
        />
        {/* ハンドル */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${percent}%` }}
        >
          {/* 吹き出し */}
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-white text-xs font-bold whitespace-nowrap"
            style={{ background: "#1e40af", borderRadius: "8px" }}
          >
            {value}
            {/* 吹き出しの三角 */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid #1e40af",
              }}
            />
          </div>
          {/* ハンドル */}
          <div
            className="w-5 h-5 rounded-full bg-white shadow-md"
            style={{ border: "3px solid #1e40af" }}
          />
        </div>
      </div>
    </div>
  );
}
