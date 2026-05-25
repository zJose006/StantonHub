# Discord OAuth en produccion

Dominio publico:

```text
https://stantonhub.com
```

Redirect URI que debe estar en Discord Developer Portal:

```text
https://stantonhub.com/api/auth/discord/callback
```

URL OAuth generada por Discord:

```text
https://discord.com/oauth2/authorize?client_id=1507435246529020034&response_type=code&redirect_uri=https%3A%2F%2Fstantonhub.com%2Fapi%2Fauth%2Fdiscord%2Fcallback&scope=identify+email
```

Configuracion del servidor Node de produccion:

```text
DISCORD_CLIENT_ID=1507435246529020034
DISCORD_CLIENT_SECRET=7labMC-qH37E_oG15LB1pRBSKRKhjoCb
DISCORD_REDIRECT_URI=https://stantonhub.com/api/auth/discord/callback
```

El boton de login de la web debe apuntar a:

```text
/api/auth/discord
```

No debe apuntar directamente a la URL de Discord, porque `server.js` necesita crear un `state` de seguridad antes de redirigir.
