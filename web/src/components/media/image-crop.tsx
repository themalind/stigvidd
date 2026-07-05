import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type CropRect = { x: number; y: number; width: number; height: number };

interface Props {
  src: string;
  onCropChange: (crop: CropRect | null) => void;
}

/**
 * Lightweight crop selector. The user drags a rectangle over the (display-scaled)
 * image; the selection is converted to natural-pixel coordinates and reported via
 * onCropChange, so the actual crop can be performed server-side by ImageMagick.
 */
export default function ImageCrop({ src, onCropChange }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  // Selection in display coordinates relative to the rendered image.
  const [sel, setSel] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  function pointerPos(e: React.PointerEvent) {
    const rect = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height),
    };
  }

  function handleDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pointerPos(e);
    setDragStart(p);
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function handleMove(e: React.PointerEvent) {
    if (!dragStart) return;
    const p = pointerPos(e);
    setSel({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    });
  }

  function handleUp() {
    const img = imgRef.current;
    if (!dragStart || !sel || !img) {
      setDragStart(null);
      return;
    }
    setDragStart(null);
    if (sel.w < 5 || sel.h < 5) {
      setSel(null);
      onCropChange(null);
      return;
    }
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    onCropChange({
      x: Math.round(sel.x * scaleX),
      y: Math.round(sel.y * scaleY),
      width: Math.round(sel.w * scaleX),
      height: Math.round(sel.h * scaleY),
    });
  }

  function clear() {
    setSel(null);
    onCropChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative inline-block max-w-full leading-none select-none">
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="max-h-80 w-auto max-w-full cursor-crosshair rounded-xs border"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
        {sel && (
          <div
            className="border-primary bg-primary/20 pointer-events-none absolute border-2"
            style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
          />
        )}
      </div>
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-xs">
          Drag on the image to set a crop region.
        </p>
        {sel && (
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear crop
          </Button>
        )}
      </div>
    </div>
  );
}
