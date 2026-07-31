import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './features/admin/layout/admin-layout.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { AdminPedidosComponent } from './features/admin/pedidos/admin-pedidos.component';
import { AdminCrearPedidoComponent } from './features/admin/crear-pedido/admin-crear-pedido.component';
import { AdminClientesComponent } from './features/admin/clientes/admin-clientes.component';
import { AdminInventarioComponent } from './features/admin/inventario/admin-inventario.component';
import { AdminReporteComponent } from './features/admin/reporte/admin-reporte.component';
import { VendorLayoutComponent } from './features/vendor/layout/vendor-layout.component';
import { VendorRutaComponent } from './features/vendor/ruta/vendor-ruta.component';
import { VendorEntregasComponent } from './features/vendor/entregas/vendor-entregas.component';
import { VendorReporteComponent } from './features/vendor/reporte/vendor-reporte.component';

import { LoginComponent } from './features/auth/login/login.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  
  // Admin Panel Routes
  {
    path: 'admin',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'pedidos', component: AdminPedidosComponent },
      { path: 'crear-pedido', component: AdminCrearPedidoComponent },
      { path: 'clientes', component: AdminClientesComponent },
      { path: 'inventario', component: AdminInventarioComponent },
      { path: 'reporte', component: AdminReporteComponent }
    ]
  },

  // Vendor Panel Routes
  {
    path: 'vendor',
    component: VendorLayoutComponent,
    children: [
      { path: '', redirectTo: 'ruta', pathMatch: 'full' },
      { path: 'ruta', component: VendorRutaComponent },
      { path: 'entregas', component: VendorEntregasComponent },
      { path: 'reporte', component: VendorReporteComponent }
    ]
  },

  // Wildcard fallback
  { path: '**', redirectTo: '' }
];
