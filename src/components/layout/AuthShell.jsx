import React from 'react';

/** Marco visual comun para paginas de acceso o permisos. */
export function AuthShell({ title, message, isError, children }) {
  return <main className="container auth-shell"><section className="auth-card panel"><span className="section-label">Acceso</span><h2>{title}</h2>{children}{message && <p className={`auth-message ${isError ? 'error' : ''}`}>{message}</p>}</section></main>;
}
