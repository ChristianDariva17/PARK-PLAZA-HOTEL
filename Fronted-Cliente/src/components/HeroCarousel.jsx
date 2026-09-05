import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import './HeroCarousel.css';
import HeroShaderBackground from './HeroShaderBackground';

const hotelData = [
  {
    place: 'Habitaciones',
    title: 'HOSPEDAJE',
    title2: '',
    description: 'Suites con vistas panorámicas, camas king size y diseño contemporáneo. Descubra el máximo confort en cada detalle de nuestras habitaciones preparadas para su descanso.',
    image: '/images/hospedaje.png',
    ctaText: 'Reservar'
  },
  {
    place: 'Bebidas',
    title: 'BAR',
    title2: '',
    description: 'Disfrute de coctelería de autor en un ambiente elegante. Nuestro equipo le sorprenderá con sabores únicos mientras se relaja al final del día.',
    image: '/images/bar.png',
    ctaText: 'Pedir bebida'
  },
  {
    place: 'Exteriores',
    title: 'TERRAZA',
    title2: '',
    description: 'Contemple los atardeceres desde nuestra terraza. Un espacio diseñado para la relajación con vistas ininterrumpidas y servicio personalizado.',
    image: '/images/terraza.png',
    ctaText: 'Reservar mesa'
  },
  {
    place: 'Vistas 360°',
    title: 'MIRADOR',
    title2: '',
    description: 'El punto más alto de nuestro resort le ofrece una vista espectacular. Sienta la inmensidad del paisaje en un entorno tranquilo y sublime.',
    image: '/images/mirador.png',
    ctaText: 'Reservar'
  },
  {
    place: 'Relajación',
    title: 'PISCINA',
    title2: '',
    description: 'Sumérjase en nuestra piscina de borde infinito que se funde con el horizonte. Rodeada de cómodas reposeras y con servicio de bar directo a su lugar.',
    image: '/images/piscina.png',
    ctaText: 'Reservar'
  },
  {
    place: 'Celebraciones',
    title: 'ZONA DE EVENTOS',
    description: 'Celebre sus momentos en nuestros majestuosos salones. Equipados con tecnología y diseño versátil, garantizamos que su evento será inolvidable.',
    image: '/images/zona_eventos.png',
    ctaText: 'Reservar evento'
  }
];

export default function HeroCarousel() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let order = [0, 1, 2, 3, 4, 5];
    let detailsEven = true;
    let offsetTop = 200;
    let offsetLeft = 700;
    let cardWidth = 200;
    let cardHeight = 300;
    let gap = 40;
    const numberSize = 50;
    const ease = "sine.inOut";

    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < 768;
      
      cardWidth = isMobile ? 80 : 200;
      cardHeight = isMobile ? 110 : 300;
      gap = isMobile ? 10 : 40;
      
      offsetTop = height - (isMobile ? 180 : 430);
      offsetLeft = isMobile ? 20 : width - 830;
    };

    let transitioning = false;
    let pendingRelayout = false;
    let resizeTimer;
    let isDestroyed = false;

    const ctx = gsap.context(() => {
      const getCard = (index) => `#card${index}`;
      const getCardContent = (index) => `#card-content-${index}`;
      const getSliderItem = (index) => `#slide-item-${index}`;
      const set = gsap.set;

      const loadImage = (src) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      const loadImages = () => Promise.all(hotelData.map(({ image }) => loadImage(image)));

      const startAutoLoop = () => {
        gsap.killTweensOf(".indicator");
        set(".indicator", { x: -window.innerWidth });
        gsap.to(".indicator", { 
          x: 0, 
          duration: 4.5, 
          ease: "none", 
          onComplete: () => {
            gsap.to(".indicator", { 
              x: window.innerWidth, 
              duration: 0.6, 
              ease: "none", 
              onComplete: () => {
                if (!isDestroyed) goTo(order[1]);
              }
            });
          }
        });
      };

      const goTo = (targetId) => {
        if (isDestroyed || transitioning) return;
        if (order[0] === targetId) return;

        transitioning = true;
        startAutoLoop(); // Reset loop timer
        
        const targetIndex = order.indexOf(targetId);
        const prvId = order[0];

        // Disparar evento para el shader 3D
        window.dispatchEvent(new CustomEvent('hero-carousel-change', { detail: { active: targetId, prev: prvId } }));

        // Rotate array
        for(let j=0; j<targetIndex; j++) {
            order.push(order.shift());
        }
        
        detailsEven = !detailsEven;
        
        const detailsActive = detailsEven ? "#details-even" : "#details-odd";
        const detailsInactive = detailsEven ? "#details-odd" : "#details-even";
        const currentData = hotelData[order[0]];
        
        const activePlace = containerRef.current.querySelector(`${detailsActive} .place-box .text`);
        const activeTitle1 = containerRef.current.querySelector(`${detailsActive} .title-1`);
        const activeDesc = containerRef.current.querySelector(`${detailsActive} .desc`);
        const activeCtaBtn = containerRef.current.querySelector(`${detailsActive} .discover`);
        
        if (activePlace) activePlace.textContent = currentData.place;
        if (activeTitle1) activeTitle1.textContent = currentData.title;
        if (activeDesc) activeDesc.textContent = currentData.description;
        if (activeCtaBtn) activeCtaBtn.textContent = currentData.ctaText;

        const [active, ...rest] = order;
        const prv = prvId;

        set(getCard(prv), { zIndex: 10 });
        set(getCard(active), { zIndex: 20 });
        gsap.to(getCard(prv), { scale: 1.5, ease });
        gsap.to(getCardContent(active), { y: offsetTop + cardHeight - 10, opacity: 0, duration: 0.3, ease });

        gsap.to(getCard(active), {
          x: 0,
          y: 0,
          width: "100vw",
          height: "100vh",
          borderRadius: 0,
          ease,
          onComplete: () => {
            if (isDestroyed) return;
            const prvRestIndex = rest.indexOf(prv);
            const xNew = offsetLeft + prvRestIndex * (cardWidth + gap);
            set(getCard(prv), { x: xNew, y: offsetTop, width: cardWidth, height: cardHeight, zIndex: 30, borderRadius: 10, scale: 1 });
            set(getCardContent(prv), { x: xNew, y: offsetTop + cardHeight - (window.innerWidth < 768 ? 75 : 100), opacity: 1, zIndex: 40 });
            set(getSliderItem(prv), { x: (prvRestIndex + 1) * numberSize });

            set(detailsInactive, { opacity: 0, zIndex: 12 });
            set(`${detailsInactive} .text`, { y: 100 });
            set(`${detailsInactive} .title-1`, { y: 100 });
            set(`${detailsInactive} .desc`, { y: 50 });
            set(`${detailsInactive} .cta`, { y: 60 });

            transitioning = false;
            if (pendingRelayout) {
              pendingRelayout = false;
              relayout();
            }
          }
        });

        rest.forEach((i, index) => {
          if (i === prv) return;
          set(getCard(i), { zIndex: 30 });
          gsap.to(getCard(i), { x: offsetLeft + index * (cardWidth + gap), y: offsetTop, width: cardWidth, height: cardHeight, ease, delay: 0.1 * (index + 1) });
          gsap.to(getCardContent(i), { x: offsetLeft + index * (cardWidth + gap), y: offsetTop + cardHeight - (window.innerWidth < 768 ? 75 : 100), opacity: 1, zIndex: 40, ease, delay: 0.1 * (index + 1) });
          gsap.to(getSliderItem(i), { x: (index + 1) * numberSize, ease });
        });

        set(detailsActive, { zIndex: 22 });
        gsap.to(detailsActive, { opacity: 1, delay: 0.4, ease });
        
        gsap.to(`${detailsActive} .text`, { y: 0, delay: 0.1, duration: 0.7, ease });
        gsap.to(`${detailsActive} .title-1`, { y: 0, delay: 0.15, duration: 0.7, ease });
        gsap.to(`${detailsActive} .desc`, { y: 0, delay: 0.3, duration: 0.4, ease });
        gsap.to(`${detailsActive} .cta`, { y: 0, delay: 0.35, duration: 0.4, ease });

        gsap.to(getSliderItem(active), { x: 0, ease });
        gsap.to(getSliderItem(prv), { x: -numberSize, ease });
        gsap.to(".progress-sub-foreground", { width: 500 * (1 / hotelData.length) * (active + 1), ease });
      };

      const init = () => {
        if (isDestroyed) return;
        updateDimensions();
        const [active, ...rest] = order;
        const detailsActive = detailsEven ? "#details-even" : "#details-odd";
        const detailsInactive = detailsEven ? "#details-odd" : "#details-even";
        const width = window.innerWidth;
        
        set("#pagination", { top: offsetTop + (width < 768 ? 200 : 330), left: offsetLeft, y: 200, opacity: 0, zIndex: 60 });
        set(getCard(active), { x: 0, y: 0, width: "100vw", height: "100vh" });
        set(getCardContent(active), { x: 0, y: 0, opacity: 0 });
        set(detailsActive, { opacity: 0, zIndex: 22, x: -200 });
        set(detailsInactive, { opacity: 0, zIndex: 12 });
        set(`${detailsInactive} .text`, { y: 100 });
        set(`${detailsInactive} .title-1`, { y: 100 });
        set(`${detailsInactive} .desc`, { y: 50 });
        set(`${detailsInactive} .cta`, { y: 60 });
        set(".progress-sub-foreground", { width: 500 * (1 / hotelData.length) * (active + 1) });
        set(".indicator", { x: -window.innerWidth });

        rest.forEach((i, index) => {
          set(getCard(i), { x: offsetLeft + 400 + index * (cardWidth + gap), y: offsetTop, width: cardWidth, height: cardHeight, zIndex: 30, borderRadius: 10 });
          set(getCardContent(i), { x: offsetLeft + 400 + index * (cardWidth + gap), zIndex: 40, y: offsetTop + cardHeight - (window.innerWidth < 768 ? 75 : 100) });
          set(getSliderItem(i), { x: (index + 1) * numberSize });
        });

        const startDelay = 0.6;

        rest.forEach((i, index) => {
          gsap.to(getCard(i), { x: offsetLeft + index * (cardWidth + gap), delay: 0.05 * index, ease });
          gsap.to(getCard(i), { delay: startDelay });
          gsap.to(getCardContent(i), { x: offsetLeft + index * (cardWidth + gap), delay: 0.05 * index, ease });
          gsap.to(getCardContent(i), { delay: startDelay });
        });

        gsap.to("#pagination", { y: 0, opacity: 1, ease, delay: startDelay });
        gsap.to(detailsActive, { opacity: 1, x: 0, ease, delay: startDelay });

        gsap.to(".cover", { x: width + 400, delay: 0.5, ease, onComplete: () => {
          if (!isDestroyed) startAutoLoop();
        }});

        // Setup click listeners for routing
        const discoverBtns = containerRef.current.querySelectorAll('.discover');
        discoverBtns.forEach(btn => {
          btn.onclick = (e) => {
            e.preventDefault();
            const currentItem = hotelData[order[0]];
            window.scrollTo(0, 0);
            if (currentItem.title === 'HOSPEDAJE') navigate('/habitaciones');
            else if (currentItem.title === 'BAR') navigate('/bar');
            else if (currentItem.title === 'TERRAZA') navigate('/terraza');
            else if (currentItem.title === 'MIRADOR') navigate('/mirador');
            else if (currentItem.title === 'PISCINA') navigate('/piscina');
            else if (currentItem.title === 'ZONA DE EVENTOS') navigate('/eventos');
          };
        });

        // Setup click listeners
        const leftArrow = containerRef.current.querySelector('.arrow-left');
        const rightArrow = containerRef.current.querySelector('.arrow-right');
        
        if (leftArrow) leftArrow.onclick = () => goTo(order[order.length - 1]);
        if (rightArrow) rightArrow.onclick = () => goTo(order[1]);

        hotelData.forEach((_, i) => {
          const cardEl = containerRef.current.querySelector(getCard(i));
          if (cardEl) {
            cardEl.onclick = () => goTo(i);
            cardEl.style.cursor = "pointer";
          }
        });
      };

      const relayout = () => {
        if (transitioning) {
          pendingRelayout = true;
          return;
        }
        
        updateDimensions();
        
        const [active, ...rest] = order;
        
        set(getCard(active), { x: 0, y: 0, width: "100vw", height: "100vh", borderRadius: 0, scale: 1 });
        
        rest.forEach((i, index) => {
          const x = offsetLeft + index * (cardWidth + gap);
          set(getCard(i), { x, y: offsetTop, width: cardWidth, height: cardHeight, borderRadius: 10 });
          set(getCardContent(i), { x, y: offsetTop + cardHeight - (window.innerWidth < 768 ? 75 : 100) });
        });
        
        set("#pagination", { top: offsetTop + (window.innerWidth < 768 ? 120 : 330), left: offsetLeft });
        set(".cover", { x: window.innerWidth + 400 });
      };

      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relayout, 150);
      };

      window.addEventListener("resize", onResize);
      window.addEventListener("load", onResize);

      const start = async () => {
        try {
          await loadImages();
          init();
        } catch (error) {
          console.log("One or more images failed to load", error);
        }
      };

      start();

      return () => {
        isDestroyed = true;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("load", onResize);
        clearTimeout(resizeTimer);
        gsap.killTweensOf(".indicator");
      };
    }, containerRef);

    return () => ctx.revert();
  }, [navigate]);

  const initialData = hotelData[0];

  return (
    <div className="hero-carousel-container" ref={containerRef}>
      <HeroShaderBackground />
      <div className="indicator"></div>
      
      <div id="demo">
        {hotelData.map((item, index) => (
          <React.Fragment key={`demo-${index}`}>
            <div className="card" id={`card${index}`} style={{ backgroundImage: `url(${item.image})` }}></div>
            <div className="card-content" id={`card-content-${index}`}>
              <div className="content-start"></div>
              <div className="content-place">{item.place}</div>
              <div className="content-title-1">{item.title}</div>
              <div className="content-title-2">{item.title2}</div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {[1, 2].map((num) => (
        <div key={`details-${num}`} className="details" id={num === 1 ? "details-even" : "details-odd"}>
          <div className="place-box"><div className="text">{initialData.place}</div></div>
          <div className="title-box-1"><div className="title-1">{initialData.title}</div></div>
          <div className="desc">{initialData.description}</div>
          <div className="cta">
            <button className="bookmark">
              <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
                <path d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"></path>
              </svg>
            </button>
            <button className="discover">{initialData.ctaText}</button>
          </div>
        </div>
      ))}

      <div className="pagination" id="pagination">
        <div className="arrow arrow-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ color: '#ffffff99' }}>
            <path d="M15.75 19.5L8.25 12l7.5-7.5"></path>
          </svg>
        </div>
        <div className="arrow arrow-right" style={{ marginLeft: '20px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ color: '#ffffff99' }}>
            <path d="M8.25 4.5l7.5 7.5-7.5 7.5"></path>
          </svg>
        </div>
        <div className="progress-sub-container">
          <div className="progress-sub-background">
            <div className="progress-sub-foreground"></div>
          </div>
        </div>
        <div className="slide-numbers" id="slide-numbers">
          {hotelData.map((_, index) => (
            <div className="item" id={`slide-item-${index}`} key={`number-${index}`}>{index + 1}</div>
          ))}
        </div>
      </div>

      <div className="cover"></div>
    </div>
  );
}
