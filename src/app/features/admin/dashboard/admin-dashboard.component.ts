import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { Order, KPIs, OrderStatus } from '../../../core/models/types';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  standalone: true
})
export class AdminDashboardComponent implements OnInit {
  private stateService = inject(StateService);
  private router = inject(Router);

  kpis: KPIs = { pending: 0, inRoute: 0, delivered: 0, totalRevenue: 0 };
  recentOrders: Order[] = [];
  selectedOrder: Order | null = null;

  ngOnInit() {
    this.stateService.kpis$.subscribe(k => this.kpis = k);
    
    // Get recent 8 orders, sorted by date desc
    this.stateService.orders$.pipe(
      map(orders => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8))
    ).subscribe(o => this.recentOrders = o);
  }

  getClientInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      loaded: 'Cargado',
      route: 'En Ruta',
      delivered: 'Entregado',
      failed: 'No Entregado',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: OrderStatus): string {
    return `badge--${status}`;
  }

  showOrderDetail(order: Order) {
    this.selectedOrder = order;
  }

  closeModal() {
    this.selectedOrder = null;
  }

  reopenOrder(orderId: string) {
    this.closeModal();
    this.router.navigate(['/admin/crear-pedido'], { queryParams: { orderId, reopen: 'true' } });
  }

  editOrder(orderId: string) {
    this.closeModal();
    this.router.navigate(['/admin/crear-pedido'], { queryParams: { orderId } });
  }
}
