import React, { useState } from 'react';
import { EventsListView } from './EventsListView';
import { EventCalendarView } from './EventCalendarView';
import { EventEditor } from './EventEditor';
import { EventDetailDrawer } from './EventDetailDrawer';
import { EventSpacePolicyEditor } from './EventSpacePolicyEditor';

export function EventsModuleRoot({ view = 'list' }) {
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isManagingPolicies, setIsManagingPolicies] = useState(false);

  const handleCreateEvent = () => {
    setSelectedEventId(null);
    setIsEditing(true);
  };

  const handleEditEvent = (id) => {
    setSelectedEventId(id);
    setIsEditing(true);
  };

  const handleSaved = () => {
    setIsEditing(false);
    // Component will unmount editor and list will re-fetch automatically via the useEventsResource hook instance inside it, 
    // or we can force refresh if we lift the state up. For this implementation, let's keep it simple.
    // In a real app we'd have a global context or pass refresh.
    window.location.reload(); // Simple force refresh for this MVP step
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  return (
    <div className="relative min-h-full h-full">
      {isManagingPolicies ? <EventSpacePolicyEditor onClose={() => setIsManagingPolicies(false)} onSaved={() => setIsManagingPolicies(false)} /> : isEditing ? (
        <EventEditor 
          eventId={selectedEventId} 
          onSaved={handleSaved} 
          onCancel={handleCancelEdit} 
        />
      ) : view === 'calendar' ? (
        <EventCalendarView 
          onSelectEvent={setSelectedEventId} 
          onCreateEvent={handleCreateEvent}
        />
      ) : (
        <EventsListView 
          onSelectEvent={setSelectedEventId} 
          onCreateEvent={handleCreateEvent}
          onManagePolicies={() => setIsManagingPolicies(true)}
        />
      )}

      {selectedEventId && !isEditing && (
        <EventDetailDrawer 
          eventId={selectedEventId} 
          onClose={() => setSelectedEventId(null)}
          onEdit={handleEditEvent}
          onRefresh={() => {
            // refresh data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
