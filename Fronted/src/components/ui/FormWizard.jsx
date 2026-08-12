import { useId, useState } from 'react';

export function FormWizard({ steps, summary, onCancel, onSubmit, submitLabel = 'Confirmar' }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const errorId = useId();
  const current = steps[step];
  const next = () => {
    const validation = current.validate?.();
    if (validation) { setError(validation); return; }
    setError('');
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };
  const submit = (event) => {
    event.preventDefault();
    const validation = current.validate?.();
    if (validation) { setError(validation); return; }
    onSubmit(event);
  };
  return <form className="wizard" onSubmit={submit} noValidate><ol className="wizard-steps" aria-label="Progreso del formulario">{steps.map((item, index) => <li key={item.label} className={index === step ? 'active' : index < step ? 'complete' : ''} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{item.label}</li>)}</ol><div className="wizard-layout"><div className="wizard-stage"><header><span>Paso {step + 1} de {steps.length}</span><h3>{current.title || current.label}</h3>{current.description ? <p>{current.description}</p> : null}</header>{error ? <div id={errorId} className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}<div aria-describedby={error ? errorId : undefined}>{current.content}</div><div className="form-actions"><button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>{step > 0 ? <button type="button" className="btn btn-outline" onClick={() => { setError(''); setStep((value) => value - 1); }}>Anterior</button> : null}{step < steps.length - 1 ? <button type="button" className="btn btn-primary" onClick={next}>Continuar</button> : <button className="btn btn-primary">{submitLabel}</button>}</div></div><aside className="wizard-summary" aria-label="Resumen persistente del formulario"><h3>Resumen</h3>{summary}</aside></div></form>;
}
