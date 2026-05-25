import { useEffect, useRef } from "react";

interface AmbientCanvasProps {
  isPlaying?: boolean;
  className?: string;
}

export function AmbientCanvas({ isPlaying = false, className }: AmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let time = 0;
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }

    const animate = () => {
      time += 0.01;

      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const gradient1 = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        canvas.width / 2
      );
      gradient1.addColorStop(0, "rgba(139, 92, 246, 0.15)");
      gradient1.addColorStop(0.5, "rgba(168, 85, 247, 0.08)");
      gradient1.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${particle.opacity})`;
        ctx.fill();
      });

      for (let i = 0; i < 3; i++) {
        const waveY = centerY + Math.sin(time + i * 2) * 100;
        const gradient = ctx.createLinearGradient(0, waveY - 50, 0, waveY + 50);
        gradient.addColorStop(0, "rgba(139, 92, 246, 0)");
        gradient.addColorStop(0.5, `rgba(168, 85, 247, ${0.1 + (isPlaying ? 0.1 : 0)})`);
        gradient.addColorStop(1, "rgba(139, 92, 246, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, waveY - 50, canvas.width, 100);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "pointer-events-none absolute inset-0 z-0"}
      aria-hidden
    />
  );
}
