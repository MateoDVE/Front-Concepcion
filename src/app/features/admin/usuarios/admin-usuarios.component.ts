import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CreateStaff, StaffService, StaffUser } from '../../../core/services/staff.service';
import { StateService } from '../../../core/services/state.service';

@Component({
  selector: 'app-admin-usuarios', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './admin-usuarios.component.html', styleUrl: './admin-usuarios.component.scss',
})
export class AdminUsuariosComponent implements OnInit {
  private readonly service = inject(StaffService);
  private readonly state = inject(StateService);
  private readonly destroyRef = inject(DestroyRef);
  users: StaffUser[] = [];
  loading = false;
  saving = false;
  loadError = '';
  error = '';
  success = '';
  showPassword = false;
  pendingStatus: StaffUser | null = null;
  updatingStatus = false;
  statusError = '';
  statusMessage = '';
  search = '';
  roleFilter = '';
  statusFilter = '';
  get filteredUsers() {
    const query = this.search.trim().toLocaleLowerCase('es');
    return this.users.filter(user =>
      (!query || `${user.nombre} ${user.usuario}`.toLocaleLowerCase('es').includes(query)) &&
      (!this.roleFilter || user.rol === this.roleFilter) &&
      (!this.statusFilter || user.activo === (this.statusFilter === 'active')));
  }

  clearFilters() { this.search = ''; this.roleFilter = ''; this.statusFilter = ''; }
  model: CreateStaff = this.emptyModel();

  ngOnInit() { this.load(); }

  requestStatusChange(user: StaffUser) {
    this.pendingStatus = user;
    this.statusError = '';
    this.statusMessage = '';
  }

  confirmStatusChange() {
    const user = this.pendingStatus;
    if (!user || this.updatingStatus) return;
    this.updatingStatus = true;
    this.statusError = '';
    this.service.setStatus(user.id, !user.activo).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.updatingStatus = false),
    ).subscribe({
      next: result => {
        this.users = this.users.map(item => item.id === result.id ? { ...item, activo: result.activo } : item);
        this.statusMessage = `${user.nombre}: usuario ${result.activo ? 'activado' : 'desactivado'}.`;
        this.pendingStatus = null;
        if (user.rol === 'vendedor') this.state.loadVendors();
      },
      error: () => this.statusError = 'No se pudo confirmar el cambio de estado. Reintenta o actualiza el listado.',
    });
  }

  private emptyModel(): CreateStaff {
    return { nombre: '', usuario: '', email: '', password: '', rol: 'vendedor', telefono: '' };
  }

  load() {
    this.loading = true;
    this.loadError = '';
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: users => this.users = users,
      error: () => this.loadError = 'No se pudo cargar el listado de usuarios.',
    });
  }

  submit(form: NgForm) {
    if (this.saving) return;
    this.error = '';
    this.success = '';
    if (form.invalid || !this.model.nombre.trim()) {
      form.control.markAllAsTouched();
      this.error = 'Revisa los campos indicados antes de crear el usuario.';
      return;
    }
    const payload = {
      ...this.model, nombre: this.model.nombre.trim(), usuario: this.model.usuario.trim().toLowerCase(),
      email: this.model.email.trim().toLowerCase(),
      telefono: this.model.rol === 'vendedor' ? this.model.telefono?.trim() : undefined,
    };
    this.saving = true;
    this.service.create(payload).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving = false)).subscribe({
      next: user => {
        if (user.rol === 'vendedor') this.state.loadVendors();
        this.success = `${user.nombre} fue creado como ${user.rol === 'vendedor' ? 'vendedor' : 'personal de almacén'}. Ya puede iniciar sesión con su correo y contraseña.`;
        this.showPassword = false;
        this.model = this.emptyModel();
        form.resetForm(this.model);
        this.load();
      },
      error: err => {
        const message = err.error?.message;
        this.error = typeof message === 'string' ? message : Array.isArray(message)
          ? 'Revisa los campos y los requisitos de la contraseña.'
          : 'No se pudo confirmar la creación. Revisa el listado antes de reintentar.';
      },
    });
  }
}
