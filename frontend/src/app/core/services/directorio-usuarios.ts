import { Service, computed, inject, signal } from '@angular/core';
import { PERMISOS } from '../config/permisos';
import { Usuario } from '../models';
import { SesionStore } from './sesion';
import { UsuariosApi } from './usuarios.api';

/**
 * Caché id → login de usuario para resolver actores (creado_por, auditoría…).
 * Se alimenta con la lista de /usuarios cuando la página ya la cargó, o la pide
 * una sola vez si la sesión tiene VER_USUARIOS (sin permiso no se pide nada).
 */
@Service()
export class DirectorioUsuarios {
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly sesion = inject(SesionStore);

  private readonly usuarios = signal<Usuario[]>([]);
  readonly lista = this.usuarios.asReadonly();
  private readonly porId = computed(() => new Map(this.usuarios().map((usuario) => [usuario.id, usuario.usuario])));

  private cargando = false;
  private cargado = false;

  /** Alimenta el directorio con una lista ya obtenida (evita una petición extra). */
  establecer(lista: Usuario[]): void {
    this.usuarios.set(lista);
    this.cargado = true;
  }

  /** Carga el directorio una sola vez. */
  cargar(): void {
    if (this.cargado || this.cargando || !this.sesion.tienePermiso(PERMISOS.VER_USUARIOS)) {
      return;
    }
    this.cargando = true;
    this.usuariosApi.listar().subscribe({
      next: (lista) => {
        this.establecer(lista);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      },
    });
  }

  nombre(id: number): string | null {
    return this.porId().get(id) ?? null;
  }
}
