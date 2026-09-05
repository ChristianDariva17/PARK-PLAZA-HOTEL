import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './HeroCarousel.css';

export default function AmenityView({ data, onBook }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Reset initial states
      gsap.set(".amenity-bg", { scale: 1.1, opacity: 0 });
      gsap.set("#amenity-details .text", { y: 100, opacity: 0 });
      gsap.set("#amenity-details .title-1", { y: 100, opacity: 0 });
      gsap.set("#amenity-details .desc", { y: 50, opacity: 0 });
      gsap.set("#amenity-details .cta", { y: 50, opacity: 0 });

      // Entrance animation
      gsap.to(".amenity-bg", { scale: 1, opacity: 1, duration: 1.5, ease: "power3.out" });
      
      gsap.to("#amenity-details .text", { y: 0, opacity: 1, duration: 0.8, delay: 0.3, ease: "power3.out" });
      gsap.to("#amenity-details .title-1", { y: 0, opacity: 1, duration: 0.8, delay: 0.4, ease: "power3.out" });
      gsap.to("#amenity-details .desc", { y: 0, opacity: 1, duration: 0.8, delay: 0.5, ease: "power3.out" });
      gsap.to("#amenity-details .cta", { y: 0, opacity: 1, duration: 0.8, delay: 0.6, ease: "power3.out" });
    }, containerRef);

    return () => ctx.revert();
  }, [data]);

  return (
    <div className="hero-carousel-container" ref={containerRef} style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div 
        className="amenity-bg" 
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundImage: `url(${data.image})`, backgroundSize: 'cover', backgroundPosition: 'center',
          zIndex: 10
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10, 28, 21, 0.9) 0%, rgba(10, 28, 21, 0.3) 50%, transparent 100%)' }}></div>
      </div>

      <div className="details" id="amenity-details" style={{ zIndex: 20, opacity: 1, transform: 'none' }}>
        <div className="place-box" style={{ overflow: 'hidden' }}><div className="text" style={{ textTransform: 'uppercase' }}>{data.place}</div></div>
        <div className="title-box-1" style={{ overflow: 'hidden' }}><div className="title-1">{data.title}</div></div>
        <div className="desc" style={{ marginTop: '20px', maxWidth: '600px', fontSize: '16px', lineHeight: '1.6', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>{data.description}</div>
        <div className="cta" style={{ marginTop: '30px', pointerEvents: 'auto' }}>
          <button className="bookmark" style={{ cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
              <path d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"></path>
            </svg>
          </button>
          <button 
            className="discover" 
            onClick={() => onBook(data.type, data.title)} 
            style={{ cursor: 'pointer', pointerEvents: 'auto', background: 'var(--color-gold)', color: 'var(--color-navy-deep)', border: 'none', fontWeight: 'bold' }}
          >
            {data.ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}
