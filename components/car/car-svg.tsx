"use client";

import { motion } from "framer-motion";
import type { CarPart } from "@/types";
import { PART_LABELS } from "@/lib/car-parts";
import { cn } from "@/lib/utils";

interface Hotspot {
  id: CarPart;
  cx: number;
  cy: number;
}

const HOTSPOTS: Hotspot[] = [
  { id: "hood", cx: 250, cy: 175 },
  { id: "front_bumper", cx: 120, cy: 210 },
  { id: "grille", cx: 175, cy: 220 },
  { id: "headlight_left", cx: 155, cy: 175 },
  { id: "headlight_right", cx: 155, cy: 245 },
  { id: "fender_left", cx: 240, cy: 120 },
  { id: "fender_right", cx: 240, cy: 300 },
  { id: "mirror_left", cx: 290, cy: 105 },
  { id: "mirror_right", cx: 290, cy: 315 },
  { id: "door_front_left", cx: 340, cy: 105 },
  { id: "door_front_right", cx: 340, cy: 315 },
  { id: "door_rear_left", cx: 430, cy: 105 },
  { id: "door_rear_right", cx: 430, cy: 315 },
  { id: "roof", cx: 380, cy: 210 },
  { id: "trunk", cx: 520, cy: 210 },
  { id: "rear_bumper", cx: 620, cy: 210 },
  { id: "taillight_left", cx: 580, cy: 170 },
  { id: "taillight_right", cx: 580, cy: 250 },
  { id: "wheel_fl", cx: 250, cy: 80 },
  { id: "wheel_fr", cx: 250, cy: 340 },
  { id: "wheel_rl", cx: 490, cy: 80 },
  { id: "wheel_rr", cx: 490, cy: 340 },
];

interface CarSvgProps {
  selectedParts?: CarPart[];
  onSelectPart?: (part: CarPart) => void;
  interactive?: boolean;
}

export function CarSvg({ selectedParts = [], onSelectPart, interactive = true }: CarSvgProps) {
  return (
    <div className="relative w-full aspect-[16/9]">
      <svg
        viewBox="0 0 720 420"
        className="w-full h-full"
        role="img"
        aria-label="Diagrama do veículo — clique nas peças danificadas"
      >
        <defs>
          <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="55%" stopColor="#9CA3AF" />
            <stop offset="100%" stopColor="#4B5563" />
          </linearGradient>
          <linearGradient id="carShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1F2937" />
            <stop offset="100%" stopColor="#0B0F17" />
          </linearGradient>
          <radialGradient id="hotspotGlow">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Floor shadow */}
        <ellipse cx="360" cy="380" rx="290" ry="18" fill="url(#carShadow)" opacity="0.6" />

        {/* Top-view car body */}
        <g>
          {/* Main body */}
          <rect x="95" y="80" width="530" height="260" rx="60" fill="url(#carBody)" />
          {/* Windshield / roof */}
          <rect x="235" y="110" width="270" height="200" rx="30" fill="#0B0F17" opacity="0.6" />
          <rect x="245" y="120" width="120" height="180" rx="18" fill="#111827" opacity="0.9" />
          <rect x="380" y="120" width="115" height="180" rx="18" fill="#111827" opacity="0.9" />

          {/* Wheels */}
          <rect x="215" y="60" width="70" height="35" rx="8" fill="#0B0F17" />
          <rect x="215" y="325" width="70" height="35" rx="8" fill="#0B0F17" />
          <rect x="455" y="60" width="70" height="35" rx="8" fill="#0B0F17" />
          <rect x="455" y="325" width="70" height="35" rx="8" fill="#0B0F17" />

          {/* Headlights */}
          <path d="M 100 145 Q 135 130 175 145 L 170 195 Q 135 190 100 200 Z" fill="#F8FAFC" opacity="0.85" />
          <path d="M 100 275 Q 135 270 175 275 L 170 225 Q 135 230 100 220 Z" fill="#F8FAFC" opacity="0.85" />

          {/* Taillights */}
          <rect x="590" y="150" width="35" height="45" rx="6" fill="#DC2626" opacity="0.7" />
          <rect x="590" y="225" width="35" height="45" rx="6" fill="#DC2626" opacity="0.7" />

          {/* Grille */}
          <rect x="115" y="205" width="35" height="30" rx="4" fill="#111827" />

          {/* Center line */}
          <line x1="360" y1="200" x2="360" y2="220" stroke="#111827" strokeWidth="2" />
        </g>

        {/* Hotspots */}
        {HOTSPOTS.map((h) => {
          const isSelected = selectedParts.includes(h.id);
          return (
            <g
              key={h.id}
              className={cn(interactive && "cursor-pointer")}
              onClick={() => interactive && onSelectPart?.(h.id)}
            >
              <title>{PART_LABELS[h.id]}</title>
              {isSelected && (
                <circle cx={h.cx} cy={h.cy} r="22" fill="url(#hotspotGlow)" />
              )}
              <motion.circle
                cx={h.cx}
                cy={h.cy}
                r="7"
                fill={isSelected ? "#3B82F6" : "#0B0F17"}
                stroke={isSelected ? "#60A5FA" : "#3B82F6"}
                strokeWidth="2"
                whileHover={interactive ? { scale: 1.4 } : undefined}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              />
              {!isSelected && (
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r="3"
                  fill="#60A5FA"
                  className="pulse-dot"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
