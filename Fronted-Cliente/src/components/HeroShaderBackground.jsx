import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import gsap from 'gsap';

// Shader disruptivo de distorsión líquida
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D tex1;
  uniform sampler2D tex2;
  uniform float progress;
  uniform float intensity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv;
    
    // Distorsión líquida basada en ondas seno
    float distortion = sin(p.y * 10.0 + progress * 5.0) * 0.1 * intensity * sin(progress * 3.14159);
    
    vec2 uv1 = p + vec2(distortion, 0.0);
    vec2 uv2 = p - vec2(distortion, 0.0);
    
    vec4 color1 = texture2D(tex1, uv1);
    vec4 color2 = texture2D(tex2, uv2);
    
    // Mezcla con efecto de desgarro
    float mixFactor = smoothstep(0.0, 1.0, progress + distortion);
    gl_FragColor = mix(color1, color2, clamp(mixFactor, 0.0, 1.0));
  }
`;

const hotelImages = [
  '/images/hospedaje.png',
  '/images/bar.png',
  '/images/terraza.png',
  '/images/mirador.png',
  '/images/piscina.png',
  '/images/zona_eventos.png'
];

function ShaderPlane({ activeIndex, prevIndex }) {
  const materialRef = useRef();
  const textures = useTexture(hotelImages);
  const { viewport } = useThree();
  
  useEffect(() => {
    if (materialRef.current) {
      // Configuramos las texturas
      materialRef.current.uniforms.tex1.value = textures[prevIndex];
      materialRef.current.uniforms.tex2.value = textures[activeIndex];
      materialRef.current.uniforms.progress.value = 0;
      
      if (activeIndex !== prevIndex) {
        // Animamos el progreso con GSAP para la transición líquida
        gsap.to(materialRef.current.uniforms.progress, {
          value: 1,
          duration: 1.2,
          ease: "power2.inOut"
        });
      }
    }
  }, [activeIndex, prevIndex, textures]);

  return (
    <mesh>
      {/* Escalar el plano para que cubra la pantalla completa */}
      <planeGeometry args={[viewport.width, viewport.height]} /> 
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          tex1: { value: textures[prevIndex] },
          tex2: { value: textures[activeIndex] },
          progress: { value: 0 },
          intensity: { value: 2.0 }
        }}
      />
    </mesh>
  );
}

export default function HeroShaderBackground() {
  const [indices, setIndices] = useState({ active: 0, prev: 0 });

  useEffect(() => {
    const handleCarouselChange = (e) => {
      setIndices({ active: e.detail.active, prev: e.detail.prev });
    };
    window.addEventListener('hero-carousel-change', handleCarouselChange);
    return () => window.removeEventListener('hero-carousel-change', handleCarouselChange);
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 21, pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        {/* Usamos Suspense porque useTexture carga asíncronamente */}
        <React.Suspense fallback={null}>
          <ShaderPlane activeIndex={indices.active} prevIndex={indices.prev} />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
