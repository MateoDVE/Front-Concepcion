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
import { VendorVentasComponent } from './features/vendor/ventas/vendor-ventas.component';

import { LoginComponent } from './features/auth/login/login.component';
import { AlmacenLayoutComponent } from './features/almacen/layout/almacen-layout.component';
import { AlmacenInventarioComponent } from './features/almacen/inventario/almacen-inventario.component';
import { AlmacenReporteComponent } from './features/almacen/reporte/almacen-reporte.component';

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
      { path: 'ventas', component: VendorVentasComponent },
      { path: 'entregas', component: VendorEntregasComponent },
      { path: 'reporte', component: VendorReporteComponent }
    ]
  },

  // Almacen Panel Routes
  {
    path: 'almacen',
    component: AlmacenLayoutComponent,
    children: [
      { path: '', redirectTo: 'inventario', pathMatch: 'full' },
      { path: 'inventario', component: AlmacenInventarioComponent },
      { path: 'reporte', component: AlmacenReporteComponent }
    ]
  },

  // Wildcard fallback
  { path: '**', redirectTo: '' }
];
