export default function ContractBlockedView({ route }) {
  return <section className="route-error state-panel state-forbidden" role="status" aria-live="polite"><h2>Contrato Backend no verificado</h2><p>El módulo {route} permanece visible, pero no muestra datos ni acciones hasta que su contrato Backend sea aprobado y verificado.</p></section>;
}
