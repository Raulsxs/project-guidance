/**
 * DraggableTextBlock — A text block that can be freely repositioned via mouse drag.
 * Positions are stored as percentages (0–100) relative to the slide container.
 */

import { useCallback, useRef, useState } from "react";

export interface BlockPosition {
  x: number; // percentage left (0–100)
  y: number; // percentage top (0–100)
}

interface DraggableTextBlockProps {
  blockKey: string;
  position: BlockPosition;
  onPositionChange?: (key: string, pos: BlockPosition) => void;
  editable?: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function DraggableTextBlock({
  blockKey,
  position,
  onPositionChange,
  editable = false,
  containerRef,
  children,
  className,
  style,
}: DraggableTextBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editable || !onPositionChange) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startX: position.x,
        startY: position.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragStart.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = ((ev.clientX - dragStart.current.mouseX) / rect.width) * 100;
        const dy = ((ev.clientY - dragStart.current.mouseY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(85, dragStart.current.startX + dx));
        const newY = Math.max(0, Math.min(90, dragStart.current.startY + dy));
        onPositionChange(blockKey, { x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragStart.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [editable, onPositionChange, position, blockKey, containerRef]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={className}
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        cursor: editable ? (isDragging ? "grabbing" : "grab") : "default",
        userSelect: isDragging ? "none" : "auto",
        zIndex: isDragging ? 50 : 10,
        maxWidth: "85%",
        transition: isDragging ? "none" : "box-shadow 0.15s ease",
        boxShadow: editable && !isDragging ? "0 0 0 1px rgba(255,255,255,0.2)" : "none",
        borderRadius: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
