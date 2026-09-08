import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { RotateCcw, PenTool, CheckCircle2 } from 'lucide-react';

export const SignatureCanvas = forwardRef(function SignatureCanvas({
  width = 500,
  height = 180,
  strokeColor = '#0F172A',
  strokeWidth = 2.5,
  backgroundColor = '#FFFFFF',
  placeholder = 'Firme aquí con el dedo, stylus o ratón',
  onChange,
  onClear,
}, ref) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPointRef = useRef(null);

  // Setup canvas with high DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || width;
    const displayHeight = height;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
  }, [width, height, strokeColor, strokeWidth, backgroundColor]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    if (e.cancelable) e.preventDefault();
    const point = getCoordinates(e);
    lastPointRef.current = point;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const currentPoint = getCoordinates(e);

    if (lastPointRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();
    }

    lastPointRef.current = currentPoint;
    if (!hasDrawn) {
      setHasDrawn(true);
    }
  };

  const stopDrawing = (e) => {
    if (isDrawing) {
      if (e && e.cancelable) e.preventDefault();
      setIsDrawing(false);
      lastPointRef.current = null;

      const canvas = canvasRef.current;
      if (canvas && onChange) {
        onChange(canvas.toDataURL('image/png'));
      }
    }
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || width;
    const displayHeight = height;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    setHasDrawn(false);
    if (onChange) onChange(null);
    if (onClear) onClear();
  }, [width, height, backgroundColor, onChange, onClear]);

  const getDataUrl = useCallback(() => {
    if (!hasDrawn) return null;
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : null;
  }, [hasDrawn]);

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty: () => !hasDrawn,
    toDataURL: getDataUrl,
  }), [clear, hasDrawn, getDataUrl]);

  return (
    <div className="signature-canvas">
      <div className={`signature-canvas-shell ${hasDrawn ? 'has-drawn' : ''}`}>
        <canvas
          ref={canvasRef}
          className="signature-canvas-input"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />

        {/* Placeholder Guide Line & Text */}
        {!hasDrawn && (
          <div className="signature-canvas-placeholder">
            <PenTool size={20} color="#CBD5E1" />
            <span>{placeholder}</span>
            <div className="signature-canvas-guide-line" />
          </div>
        )}

        {/* Signed Indicator badge */}
        {hasDrawn && (
          <div className="signature-canvas-captured-badge">
            <CheckCircle2 size={12} /> Firma capturada
          </div>
        )}
      </div>

      <div className="signature-canvas-footer">
        <span className="signature-canvas-hint">
          * Dibuje su firma en el recuadro con el dedo o ratón.
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={!hasDrawn}
          className={`signature-canvas-clear ${hasDrawn ? 'has-drawn' : ''}`}
        >
          <RotateCcw size={13} /> Limpiar firma
        </button>
      </div>
    </div>
  );
});
