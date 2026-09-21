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
  const [refreshVersion, setRefreshVersion] = useState(0);

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
    setRefreshVersion((value) => value + 1);
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
          key={`calendar-${refreshVersion}`}
          onSelectEvent={setSelectedEventId} 
          onCreateEvent={handleCreateEvent}
        />
      ) : (
        <EventsListView 
          key={`list-${refreshVersion}`}
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
          onRefresh={() => setRefreshVersion((value) => value + 1)}
        />
      )}
    </div>
  );
}
