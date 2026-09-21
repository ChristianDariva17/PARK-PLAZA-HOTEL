let moduleStylesPromise

export function loadModuleStyles() {
  moduleStylesPromise ||= Promise.all([
    import('./components.css'),
    import('./modules.css'),
    import('./tables-forms.css'),
    import('./overlays.css'),
  ])
  return moduleStylesPromise
}
