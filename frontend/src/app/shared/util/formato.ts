/** Login con "@" delante, sin duplicarlo si el login ya lo incluye (p. ej. "@admin"). */
export function formatearLogin(login: string | null | undefined): string {
  if (!login) {
    return '—';
  }
  return login.startsWith('@') ? login : `@${login}`;
}

export function iniciales(nombre?: string | null, apellido?: string | null): string {
  return `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase() || '?';
}

const NUMERO = new Intl.NumberFormat('es');

export function formatearNumero(valor: number): string {
  return NUMERO.format(valor);
}

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}
