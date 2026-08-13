import React, { useRef, useEffect, useCallback } from 'react';

type Props = {
  // Appelé quand la signature change : reçoit un fichier PNG (fond transparent) ou null si effacée.
  onChange: (file: File | null) => void;
  height?: number;
};

/**
 * Zone de signature à l'écran (souris ou tactile). Produit un PNG à fond transparent
 * exploitable comme n'importe quel upload de signature.
 */
export default function SignaturePad({ onChange, height = 170 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111';
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawn.current = true;
  };

  const exportSignature = useCallback(() => {
    const canvas = canvasRef.current!;
    if (!hasDrawn.current) { onChange(null); return; }
    canvas.toBlob((blob) => {
      onChange(blob ? new File([blob], 'signature.png', { type: 'image/png' }) : null);
    }, 'image/png');
  }, [onChange]);

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    exportSignature();
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={height * 2}
        style={{
          border: '1px solid #ced4da',
          borderRadius: 6,
          width: '100%',
          height,
          background: '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
          display: 'block',
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="d-flex justify-content-between align-items-center mt-1">
        <small className="text-muted">Signez avec la souris ou le doigt.</small>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clear}>Effacer</button>
      </div>
    </div>
  );
}
