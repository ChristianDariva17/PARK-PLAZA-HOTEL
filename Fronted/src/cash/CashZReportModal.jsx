import { useState, useMemo } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Printer, Copy, Check, Receipt, Building2, User, Clock, Calendar, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

function formatReceiptDateTime(dateStr) {
  if (!dateStr) return 'Pendiente';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function CashZReportModal({ open, onClose, session, movements = [] }) {
  const [copied, setCopied] = useState(false);

  const calculations = useMemo(() => {
    if (!session) return null;

    const sessionMovements = movements.filter((m) => m.sessionId === session.id && m.type !== 'Sesión');
    const cashMovements = sessionMovements.filter((m) => !m.method || m.method === 'Efectivo');
    
    const incomeMovements = cashMovements.filter((m) => m.type === 'Ingreso');
    const expenseMovements = cashMovements.filter((m) => m.type === 'Egreso');

    const incomeTotal = incomeMovements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const expenseTotal = expenseMovements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const openingAmount = Number(session.openingAmount) || 0;
    const expectedAmount = session.expectedAmount != null 
      ? Number(session.expectedAmount) 
      : openingAmount + incomeTotal - expenseTotal;
    const countedAmount = session.countedAmount != null ? Number(session.countedAmount) : null;
    const difference = session.difference != null 
      ? Number(session.difference) 
      : countedAmount != null ? countedAmount - expectedAmount : 0;

    // Parse breakdown from notes if present
    let breakdownPart = null;
    let cleanNotes = session.notes || '';
    const match = cleanNotes.match(/\[Conteo Físico PEN:\s*([^\]]+)\]/);
    if (match) {
      breakdownPart = match[1];
      cleanNotes = cleanNotes.replace(/\[Conteo Físico PEN:[^\]]+\]/, '').replace(/^[\s·]+|[\s·]+$/g, '');
    }

    return {
      sessionMovements,
      incomeMovements,
      expenseMovements,
      incomeTotal,
      expenseTotal,
      openingAmount,
      expectedAmount,
      countedAmount,
      difference,
      breakdownPart,
      cleanNotes,
    };
  }, [session, movements]);

  if (!open || !session || !calculations) return null;

  const {
    sessionMovements,
    incomeTotal,
    expenseTotal,
    openingAmount,
    expectedAmount,
    countedAmount,
    difference,
    breakdownPart,
    cleanNotes,
  } = calculations;

  const isExact = Math.abs(difference) < 0.01;
  const isSurplus = difference > 0.01;
  const isDeficit = difference < -0.01;

  const diffLabel = isExact
    ? 'CUADRE EXACTO (S/ 0.00)'
    : isSurplus
    ? `SOBRANTE (+${formatMoney(difference)})`
    : `FALTANTE (${formatMoney(difference)})`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = [
      '========================================',
      '       HOTEL PARK PLAZA & SUITES        ',
      '       CORTE Z · CIERRE DE CAJA        ',
      '========================================',
      `ID Sesión:   ${session.id}`,
      `Responsable: ${session.responsible}`,
      `Turno:       ${session.shift}`,
      `Apertura:    ${formatReceiptDateTime(session.openedAt)}`,
      `Cierre:      ${formatReceiptDateTime(session.closedAt || new Date().toISOString())}`,
      `Estado:      ${session.status.toUpperCase()}`,
      '----------------------------------------',
      '          BALANCE GENERAL (PEN)         ',
      '----------------------------------------',
      `(+) Fondo Apertura:     ${formatMoney(openingAmount)}`,
      `(+) Total Ingresos:     ${formatMoney(incomeTotal)}`,
      `(-) Total Egresos:      ${formatMoney(expenseTotal)}`,
      '----------------------------------------',
      `(=) Saldo Esperado:     ${formatMoney(expectedAmount)}`,
      `(*) Efectivo Contado:   ${countedAmount != null ? formatMoney(countedAmount) : 'No registrado'}`,
      '----------------------------------------',
      `DIFERENCIA:             ${diffLabel}`,
      '----------------------------------------',
      breakdownPart ? `DESGLOSE FÍSICO:\n${breakdownPart}\n----------------------------------------` : '',
      cleanNotes ? `OBSERVACIONES:\n${cleanNotes}\n----------------------------------------` : '',
      '========================================',
      'FIRMAS DE CONFORMIDAD:',
      '',
      '_______________________   _______________________',
      'Firma Cajero Saliente     Firma Supervisor/Admin',
      'DNI:                      DNI:',
      '========================================',
    ].filter(Boolean).join('\n');

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Comprobante de Cierre de Caja · Corte Z"
      description="Ticket de arqueo y liquidación final de turno en formato térmico estándar (80mm)."
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #corte-z-printable-ticket, #corte-z-printable-ticket * {
            visibility: visible !important;
          }
          #corte-z-printable-ticket {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 8mm 6mm !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            z-index: 999999 !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        {/* Contenedor del Ticket Térmico 80mm */}
        <div
          id="corte-z-printable-ticket"
          style={{
            width: '100%',
            maxWidth: '360px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
            padding: '24px 20px',
            color: '#0f172a',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          {/* Cabecera del Hotel */}
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
              <Building2 size={18} style={{ color: '#0f172a' }} />
              <span style={{ fontWeight: '800', fontSize: '15px', letterSpacing: '0.05em' }}>PARK PLAZA HOTEL</span>
            </div>
            <div style={{ fontSize: '10px', color: '#475569' }}>HOTEL & SUITES DE LUJO *****</div>
            <div style={{ fontSize: '10px', color: '#475569' }}>RUC: 20458912301 · CUSCO / LIMA</div>
            <div style={{ fontSize: '10px', color: '#475569' }}>TEL: +51 (01) 445-8900</div>
          </div>

          <div style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', padding: '6px 0', textAlign: 'center', margin: '10px 0' }}>
            <strong style={{ fontSize: '13px', letterSpacing: '0.08em', display: 'block' }}>CORTE Z · CIERRE DE CAJA</strong>
            <span style={{ fontSize: '10px', color: '#334155' }}>DOCUMENTO INTERNO DE CONTROL Y AUDITORÍA</span>
          </div>

          {/* Información del Turno */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '12px 0', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>Sesión ID:</span>
              <strong>#{session.id.slice(0, 10).toUpperCase()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>Cajero / Responsable:</span>
              <strong>{session.responsible}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>Turno Asignado:</span>
              <strong>{session.shift}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>Apertura:</span>
              <span>{formatReceiptDateTime(session.openedAt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>Cierre:</span>
              <span>{formatReceiptDateTime(session.closedAt || new Date().toISOString())}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#475569' }}>Estado Final:</span>
              <strong style={{ color: session.status === 'Abierta' ? '#d97706' : '#16a34a' }}>
                {session.status.toUpperCase()}
              </strong>
            </div>
          </div>

          {/* Separador Dashed */}
          <div style={{ borderBottom: '1px dashed #94a3b8', margin: '10px 0' }} />

          {/* Resumen Financiero */}
          <div style={{ margin: '10px 0' }}>
            <div style={{ textAlign: 'center', fontWeight: '700', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.05em' }}>
              [ RESUMEN FINANCIERO DE EFECTIVO ]
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Fondo Inicial Apertura:</span>
                <strong>{formatMoney(openingAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Total Ingresos Turno:</span>
                <strong style={{ color: '#16a34a' }}>+{formatMoney(incomeTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(-) Total Egresos Turno:</span>
                <strong style={{ color: '#dc2626' }}>-{formatMoney(expenseTotal)}</strong>
              </div>
              
              <div style={{ borderBottom: '1px solid #cbd5e1', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ fontWeight: '700' }}>(=) Saldo Teórico Esperado:</span>
                <strong style={{ fontWeight: '800' }}>{formatMoney(expectedAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ fontWeight: '700' }}>(•) Efectivo Contado Físico:</span>
                <strong style={{ fontWeight: '800' }}>
                  {countedAmount != null ? formatMoney(countedAmount) : 'Pendiente'}
                </strong>
              </div>

              <div style={{ borderBottom: '2px solid #0f172a', margin: '6px 0' }} />

              {/* Resultado del Cuadre */}
              <div style={{
                padding: '8px 10px',
                backgroundColor: isExact ? '#f0fdf4' : isSurplus ? '#fefce8' : '#fef2f2',
                border: `1px solid ${isExact ? '#bbf7d0' : isSurplus ? '#fde047' : '#fecaca'}`,
                borderRadius: '6px',
                textAlign: 'center',
                margin: '4px 0',
              }}>
                <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Resultado de Auditoría / Cuadre
                </div>
                <strong style={{
                  fontSize: '13px',
                  color: isExact ? '#15803d' : isSurplus ? '#a16207' : '#b91c1c',
                  display: 'block',
                }}>
                  {diffLabel}
                </strong>
              </div>
            </div>
          </div>

          {/* Desglose de Billetes y Monedas si existe */}
          {breakdownPart && (
            <>
              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '10px 0' }} />
              <div style={{ margin: '8px 0' }}>
                <div style={{ textAlign: 'center', fontWeight: '700', marginBottom: '6px', fontSize: '10.5px' }}>
                  [ CONTEO FÍSICO DETALLADO (PEN) ]
                </div>
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '10.5px',
                  wordBreak: 'break-word',
                  color: '#334155',
                }}>
                  {breakdownPart}
                </div>
              </div>
            </>
          )}

          {/* Movimientos Resumen */}
          {sessionMovements.length > 0 && (
            <>
              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '10px 0' }} />
              <div style={{ margin: '8px 0' }}>
                <div style={{ textAlign: 'center', fontWeight: '700', marginBottom: '6px', fontSize: '10.5px' }}>
                  [ MOVIMIENTOS REGISTRADOS ({sessionMovements.length}) ]
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px' }}>
                  {sessionMovements.slice(0, 10).map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                        {m.type === 'Ingreso' ? '+ ' : '- '}{m.concept || 'Movimiento'}
                      </span>
                      <strong style={{ color: m.type === 'Ingreso' ? '#16a34a' : '#dc2626' }}>
                        {formatMoney(m.amount)}
                      </strong>
                    </div>
                  ))}
                  {sessionMovements.length > 10 && (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '10px', marginTop: '2px' }}>
                      ... y {sessionMovements.length - 10} movimiento(s) más.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Observaciones */}
          {cleanNotes && (
            <>
              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '10px 0' }} />
              <div style={{ margin: '8px 0', fontSize: '10.5px' }}>
                <strong style={{ display: 'block', marginBottom: '3px' }}>OBSERVACIONES:</strong>
                <span style={{ color: '#334155' }}>{cleanNotes}</span>
              </div>
            </>
          )}

          {/* Firmas de Conformidad */}
          <div style={{ borderBottom: '1px dashed #94a3b8', margin: '16px 0 12px' }} />
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '26px',
            textAlign: 'center',
            fontSize: '9.5px',
          }}>
            <div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: '700' }}>
                FIRMA CAJERO
              </div>
              <div style={{ color: '#475569' }}>{session.responsible}</div>
              <div style={{ color: '#64748b' }}>DNI: ______________</div>
            </div>
            <div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: '700' }}>
                SUPERVISOR / ADMIN
              </div>
              <div style={{ color: '#475569' }}>Control Operativo</div>
              <div style={{ color: '#64748b' }}>DNI: ______________</div>
            </div>
          </div>

          {/* Pie de Página */}
          <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '9px', color: '#64748b' }}>
            <div>Generado por Park Plaza Hotel PMS/POS v2.4</div>
            <div>Impreso el: {formatReceiptDateTime(new Date().toISOString())}</div>
            <div style={{ marginTop: '3px', letterSpacing: '0.1em' }}>*** FIN DEL CORTE Z ***</div>
          </div>
        </div>

        {/* Barra de Acciones del Modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '360px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleCopy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Copiar texto resumen para WhatsApp o correo"
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#0f172a', borderColor: '#0f172a' }}
            >
              <Printer size={14} />
              <span>Imprimir Corte Z</span>
            </button>
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Dialog>
  );
}
