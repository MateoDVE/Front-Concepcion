import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { Order, OrderStatus } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';

type FilterStatus = 'all' | OrderStatus;

@Component({
  selector: 'app-admin-pedidos',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.scss',
  standalone: true
})
export class AdminPedidosComponent implements OnInit {
  private stateService = inject(StateService);
  private router = inject(Router);

  orders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;
  showDeleteOrderModal = false;
  pendingDeleteOrderId: string | null = null;

  // Search & Filter state
  searchQuery = '';
  activeFilter: FilterStatus = 'all';

  ngOnInit() {
    this.stateService.orders$.subscribe(o => {
      this.orders = o;
      this.applyFilterAndSearch();
    });
  }

  onSearchChange() {
    this.applyFilterAndSearch();
  }

  setFilter(filter: FilterStatus) {
    this.activeFilter = filter;
    this.applyFilterAndSearch();
  }

  applyFilterAndSearch() {
    let result = [...this.orders];

    // Apply active status filter
    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'route') {
        // En ruta contains both 'route' and 'loaded'
        result = result.filter(o => o.status === 'route' || o.status === 'loaded');
      } else {
        result = result.filter(o => o.status === this.activeFilter);
      }
    }

    // Apply search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(o => 
        o.clientName.toLowerCase().includes(q) || 
        o.id.toLowerCase().includes(q) ||
        (o.vendorName && o.vendorName.toLowerCase().includes(q))
      );
    }

    // Sort by date desc
    this.filteredOrders = result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  deleteOrder(orderId: string) {
    this.pendingDeleteOrderId = orderId;
    this.showDeleteOrderModal = true;
  }

  cancelDeleteOrder() {
    this.showDeleteOrderModal = false;
    this.pendingDeleteOrderId = null;
  }

  confirmDeleteOrder() {
    if (!this.pendingDeleteOrderId) return;

    this.stateService.deleteOrder(this.pendingDeleteOrderId);
    this.cancelDeleteOrder();
    this.closeModal();
  }
}
