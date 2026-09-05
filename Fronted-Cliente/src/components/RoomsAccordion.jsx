import React, { useState } from 'react';
import './RoomsAccordion.css';

export default function RoomsAccordion({ rooms, onBook }) {
  // Default to the first room being active
  const [active, setActive] = useState(0);

  const handleWheel = (e) => {
    // Prevent default scrolling to keep the page still while changing active item
    if (e.deltaY > 0) {
      setActive((prev) => (prev < rooms.length - 1 ? prev + 1 : prev));
    } else if (e.deltaY < 0) {
      setActive((prev) => (prev > 0 ? prev - 1 : prev));
    }
  };

  return (
    <div className="rooms-accordion-container" onWheel={handleWheel} style={{ pointerEvents: 'auto', position: 'relative', zIndex: 60 }}>
      {rooms.map((room, index) => {
        const isActive = active === index;
        
        return (
          <div 
            key={room.code || index} 
            className={`accordion-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              setActive(index);
            }}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Background Image with continuous zoom */}
            <div 
              className="accordion-bg" 
              style={{ backgroundImage: `url(${room.img})` }}
            ></div>
            
            {/* Vertical Title (visible only when NOT active) */}
            <div className="accordion-title-vertical">
              {room.title}
            </div>
            
            {/* Content Details (visible only when active) */}
            <div className="accordion-content" style={{ pointerEvents: isActive ? 'auto' : 'none' }}>
              <div className="accordion-details" style={{ pointerEvents: isActive ? 'auto' : 'none' }}>
                <h2>{room.title}</h2>
                <span className="accordion-price">{room.price}</span>
                <p className="accordion-desc">{room.desc}</p>
                {room.amenities && room.amenities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '10px 0 16px' }}>
                    {room.amenities.slice(0, 4).map((am, i) => (
                      <span key={i} style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.18)',
                        backdropFilter: 'blur(8px)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.28)',
                        fontWeight: '500',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {am}
                      </span>
                    ))}
                  </div>
                )}
                <button 
                  className="accordion-btn" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent triggering the card click
                    onBook(room);
                  }}
                  style={{ zIndex: 100, position: 'relative', pointerEvents: 'auto' }}
                >
                  Reservar ahora
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
