import React, { useEffect, useState } from 'react';
import { DiscordIcon } from '../components/icons/DiscordIcon.jsx';
import { AuthShell } from '../components/layout/AuthShell.jsx';

/** Pagina unica de acceso: inicia o crea cuenta exclusivamente mediante Discord OAuth. */
export function LoginPage() {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    const messages = { discord_config: 'Falta configurar Discord en el servidor.', discord_state: 'Discord devolvio una sesion no valida. Intentalo de nuevo.', discord_login: 'No se pudo completar el login con Discord.' };
    if (messages[error]) { setMessage(messages[error]); setIsError(true); }
  }, []);

  return <AuthShell title="Acceso con Discord" message={message} isError={isError}><div className="auth-lead"><span className="discord-orb"><DiscordIcon /></span><p>Stanton Hub usa Discord como unico sistema de acceso. Al entrar, se crea o recupera tu perfil automaticamente con tu identidad de Discord.</p></div><a className="action-btn primary-action discord-action" href="/api/auth/discord"><DiscordIcon /> <span>Entrar con Discord</span></a><div className="auth-discord-notes"><article><strong>Acceso centralizado</strong><span>No usamos password local. Guardamos tu correo de Discord para identificar tu cuenta.</span></article><article><strong>Perfil automatico</strong><span>Si es tu primera vez, tu usuario se crea con rol Piloto.</span></article><article><strong>Roles internos</strong><span>Los permisos se gestionan despues desde Administracion.</span></article></div></AuthShell>;
}
