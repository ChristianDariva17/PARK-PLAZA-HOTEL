import { useState } from 'react';
import { PermissionGate } from '../auth/PermissionButton.jsx';
import { Dialog } from '../ui/Overlay.jsx';

export default function ReasonDialog({ operation, onClose }) {
  return (
    <Dialog
      open={Boolean(operation)}
      onClose={onClose}
      title={operation?.title || 'Confirmar operación'}
      description="El registro histórico no se eliminará."
    >
      {operation ? (
        <ReasonForm operation={operation} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function ReasonForm({ operation, onClose }) {
  const fields = operation.fields || [{ key: 'reason', label: 'Motivo' }];
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.key, ''])),
  );
  const submit = async (event) => {
    event.preventDefault();
    if ((await operation.onConfirm(values)) !== false) onClose();
  };
  return (
    <PermissionGate actionType={operation.actionType}>
      <form className="form-grid" onSubmit={submit}>
        {fields.map((field) => (
          <label className="span-2" key={field.key}>
            {field.label}
            <textarea
              required
              value={values[field.key]}
              onChange={(event) =>
                setValues({ ...values, [field.key]: event.target.value })
              }
            />
          </label>
        ))}
        <div className="form-actions span-2">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Volver
          </button>
          <button className="btn btn-danger">Confirmar</button>
        </div>
      </form>
    </PermissionGate>
  );
}
