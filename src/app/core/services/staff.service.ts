import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG } from '../config/constants';

export interface StaffUser {
  id: string;
  nombre: string;
  usuario: string;
  rol: 'vendedor' | 'almacen';
  activo: boolean;
}
export interface CreateStaff {
  nombre: string;
  usuario: string;
  email: string;
  password: string;
  rol: 'vendedor' | 'almacen';
  telefono?: string;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  list() { return this.http.get<StaffUser[]>(`${APP_CONFIG.apiUrl}/users/staff`); }
  create(data: CreateStaff) { return this.http.post<StaffUser>(`${APP_CONFIG.apiUrl}/users/staff`, data); }
  setStatus(id: string, activo: boolean) {
    return this.http.patch<{ id: string; activo: boolean }>(`${APP_CONFIG.apiUrl}/users/staff/${id}/status`, { activo });
  }
}
