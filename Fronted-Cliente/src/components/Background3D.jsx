import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// --- Texturas compartidas ---
function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.beginPath();
  context.arc(32, 32, 30, 0, 2 * Math.PI, false);
  context.fillStyle = '#ffffff';
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

function createMoonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  
  // Círculo principal
  context.beginPath();
  context.arc(32, 32, 28, 0, 2 * Math.PI, false);
  context.fillStyle = '#ffffff';
  context.fill();
  
  // Cortar para hacer la media luna
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  context.arc(42, 22, 26, 0, 2 * Math.PI, false);
  context.fill();
  
  return new THREE.CanvasTexture(canvas);
}

// Componente interactivo (reutilizable)
function ParticleSystem({ count, texture, size }) {
  const pointsRef = useRef();
  const { viewport } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event) => {
      // Normalizar coordenadas del ratón de -1 a 1
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Generar posiciones aleatorias para miles de esporas
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 25; // x
      p[i * 3 + 1] = (Math.random() - 0.5) * 25; // y
      p[i * 3 + 2] = (Math.random() - 0.5) * 15; // z
    }
    return p;
  }, [count]);

  const originalPositions = useMemo(() => positions.slice(), [positions]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    // Obtener la posición del ratón en el mundo 3D
    const mouseX = (mouse.current.x * viewport.width) / 2;
    const mouseY = (mouse.current.y * viewport.height) / 2;

    const positions = pointsRef.current.geometry.attributes.position.array;
    const time = state.clock.elapsedTime;
    
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      // Movimiento natural base (flotando suavemente)
      const originX = originalPositions[ix];
      const originY = originalPositions[iy];
      const originZ = originalPositions[iz];

      let targetX = originX + Math.sin(time * 0.3 + originY) * 0.8;
      let targetY = originY + Math.cos(time * 0.2 + originX) * 0.8;
      
      // Efecto interactivo con el ratón
      // Calculamos la distancia de la partícula al ratón
      const dx = targetX - mouseX;
      const dy = targetY - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Radio de interacción
      const interactionRadius = 4.5;

      if (distance < interactionRadius) {
        // Fuerza de atracción/repulsión
        const force = (interactionRadius - distance) / interactionRadius;
        
        // Efecto de remolino alrededor del cursor
        targetX += dy * force * 0.15;
        targetY -= dx * force * 0.15;
        
        // Ligera atracción hacia el centro del cursor
        targetX -= dx * force * 0.05;
        targetY -= dy * force * 0.05;
      }

      // Interpolación suave hacia la posición objetivo
      positions[ix] += (targetX - positions[ix]) * 0.08;
      positions[iy] += (targetY - positions[iy]) * 0.08;
      
      // El eje Z tiene un leve oleaje
      positions[iz] = originZ + Math.sin(time * 0.5 + originX) * 0.4;
    }
    
    // Rotación lenta de todo el campo de esporas
    pointsRef.current.rotation.y = time * 0.03;
    pointsRef.current.rotation.x = Math.sin(time * 0.1) * 0.05;
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        map={texture}
        alphaMap={texture}
        alphaTest={0.5}
        color="#d4af37" // Color dorado de lujo
        transparent
        opacity={0.9}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function Background3D() {
  const circleTex = useMemo(() => createCircleTexture(), []);
  const moonTex = useMemo(() => createMoonTexture(), []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 50, pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.5} />
        
        {/* Esferas doradas */}
        <ParticleSystem count={3500} texture={circleTex} size={0.05} />
        
        {/* Medias lunas mágicas (menos cantidad, un poco más grandes) */}
        <ParticleSystem count={300} texture={moonTex} size={0.08} />
        
        {/* Chispas adicionales de fondo para darle más magia */}
        <Sparkles count={800} scale={20} size={1.5} speed={0.2} opacity={0.4} color="#fdf5d3" />
        
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
