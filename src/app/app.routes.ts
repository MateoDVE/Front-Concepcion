import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  
  // Admin Panel Routes
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./features/admin/pedidos/admin-pedidos.component').then(m => m.AdminPedidosComponent)
      },
      {
        path: 'crear-pedido',
        loadComponent: () => import('./features/admin/crear-pedido/admin-crear-pedido.component').then(m => m.AdminCrearPedidoComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/admin/clientes/admin-clientes.component').then(m => m.AdminClientesComponent)
      },
      {
        path: 'inventario',
        loadComponent: () => import('./features/admin/inventario/admin-inventario.component').then(m => m.AdminInventarioComponent)
      },
      {
        path: 'reporte',
        loadComponent: () => import('./features/admin/reporte/admin-reporte.component').then(m => m.AdminReporteComponent)
      }
    ]
  },

  // Vendor Panel Routes
  {
    path: 'vendor',
    loadComponent: () => import('./features/vendor/layout/vendor-layout.component').then(m => m.VendorLayoutComponent),
    children: [
      { path: '', redirectTo: 'ruta', pathMatch: 'full' },
      {
        path: 'ruta',
        loadComponent: () => import('./features/vendor/ruta/vendor-ruta.component').then(m => m.VendorRutaComponent)
      },
      {
        path: 'ventas',
        loadComponent: () => import('./features/vendor/ventas/vendor-ventas.component').then(m => m.VendorVentasComponent)
      },
      {
        path: 'entregas',
        loadComponent: () => import('./features/vendor/entregas/vendor-entregas.component').then(m => m.VendorEntregasComponent)
      },
      {
        path: 'reporte',
        loadComponent: () => import('./features/vendor/reporte/vendor-reporte.component').then(m => m.VendorReporteComponent)
      }
    ]
  },

  // Almacen Panel Routes
  {
    path: 'almacen',
    loadComponent: () => import('./features/almacen/layout/almacen-layout.component').then(m => m.AlmacenLayoutComponent),
    children: [
      { path: '', redirectTo: 'inventario', pathMatch: 'full' },
      {
        path: 'inventario',
        loadComponent: () => import('./features/almacen/inventario/almacen-inventario.component').then(m => m.AlmacenInventarioComponent)
      },
      {
        path: 'reporte',
        loadComponent: () => import('./features/almacen/reporte/almacen-reporte.component').then(m => m.AlmacenReporteComponent)
      }
    ]
  },

  // Wildcard fallback
  { path: '**', redirectTo: '' }
];

