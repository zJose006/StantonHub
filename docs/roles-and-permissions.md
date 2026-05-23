# Roles y permisos de Stanton Hub

La web usa una jerarquia inspirada en Star Citizen. Cada usuario tiene un rol en la tabla `users.role`.

Para darte acceso total despues de iniciar sesion con Discord, cambia tu usuario a:

```sql
UPDATE users
SET role = 'Administrador'
WHERE email = 'TU_EMAIL_DE_DISCORD';
```

Tambien puedes localizar tu cuenta con:

```sql
SELECT id, username, email, role, auth_provider
FROM users
ORDER BY created_at DESC;
```

## Jerarquia

| Nivel | Rol | Enfoque |
| --- | --- | --- |
| 10 | Recluta | Usuario inicial de baja confianza. |
| 20 | Piloto | Usuario comun de la web. |
| 30 | Especialista | Creador de guias y contenido con capturas. |
| 40 | Oficial | Moderacion de contenido y capturas. |
| 50 | Comandante | Gestion de usuarios y moderacion amplia. |
| 60 | Administrador | Control total de la web. |

## Permisos

| Permiso | Recluta | Piloto | Especialista | Oficial | Comandante | Administrador |
| --- | --- | --- | --- | --- | --- | --- |
| Votar publicaciones | Si | Si | Si | Si | Si | Si |
| Comentar publicaciones | Si | Si | Si | Si | Si | Si |
| Publicar consejos o intel | No | Si | Si | Si | Si | Si |
| Publicar guias | No | No | Si | Si | Si | Si |
| Subir capturas | No | No | Si | Si | Si | Si |
| Eliminar publicaciones | No | No | No | Si | Si | Si |
| Eliminar capturas | No | No | No | Si | Si | Si |
| Modificar roles de usuarios | No | No | No | No | Si | Si |
| Asignar Administrador | No | No | No | No | No | Si |
| Sincronizar naves con UEX | No | No | No | No | No | Si |
| Acceder al panel de administracion | No | No | No | No | No | Si |

## Notas de seguridad

- La sincronizacion de UEX esta bloqueada en servidor si el usuario no tiene `ships.sync`.
- El panel de administracion requiere `admin.access`.
- La API publica de estado no envia hashes de contrasena, `discord_id` ni el listado completo de usuarios.
- El `DISCORD_CLIENT_SECRET` debe quedarse siempre en `.env`, que esta ignorado por Git.
- `users.last_login_at` guarda el ultimo acceso conocido del usuario.
- El acceso por correo y contrasena esta desactivado. Login y registro usan exclusivamente Discord OAuth.
