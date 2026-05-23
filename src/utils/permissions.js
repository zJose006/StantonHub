/** Comprueba si el usuario actual tiene un permiso concreto. */
export function can(user, permission) { return Boolean(user?.permissions?.includes(permission)); }
