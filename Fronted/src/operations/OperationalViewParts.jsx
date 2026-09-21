export function StatusStepper({ currentStatus, steps, compact = false }) {
  const currentIndex = steps.indexOf(currentStatus);
  return (
    <div className={`status-stepper-container ${compact ? 'is-compact' : ''}`}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;

        return (
          <div key={step} className={`status-step ${isCompleted ? 'step-completed' : isActive ? 'step-active' : 'step-pending'}`}>
            <div className={`status-step-dot ${isCompleted ? 'step-dot-completed' : isActive ? 'step-dot-active' : 'step-dot-pending'}`} />
            {idx < steps.length - 1 && (
              <div className={`status-step-line step-line-${isCompleted ? 'completed' : 'pending'}`} />
            )}
            <span className={`status-step-label step-label-${isActive ? 'active' : 'pending'}`}>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PriorityTag({ priority }) {
  const norm = String(priority || '').toLowerCase().trim();
  let icon = '⚡';

  if (norm === 'urgente' || norm === 'urgent') {
    icon = '🚨';
  } else if (norm === 'alta' || norm === 'high') {
    icon = '⚠️';
  } else if (norm === 'media' || norm === 'medium') {
    icon = '⏱️';
  } else if (norm === 'baja' || norm === 'low') {
    icon = '📋';
  }

  return (
    <span className={`priority-tag priority-tag-${norm || 'default'}`}>
      <span>{icon}</span> {priority}
    </span>
  );
}
