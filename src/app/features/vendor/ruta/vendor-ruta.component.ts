import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor, OrderStatus } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-vendor-ruta',
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-ruta.component.html',
  styleUrl: './vendor-ruta.component.scss',
  standalone: true
})
export class VendorRutaComponent implements OnInit {
  private stateService = inject(StateService);

  activeVendor: Vendor | null = null;
  vendorOrders: Order[] = [];
  
  // Progress indicators
  totalRouteCount = 0;
  completedRouteCount = 0;
  progressPercent = 0;

  // Selected Order for Falla Modal
  failingOrder: Order | null = null;
  failReason = 'Cliente Ausente';
  showFailModal = false;

  // Track expanded cards
  expandedOrderIds = new Set<string>();

  ngOnInit() {
    this.stateService.activeVendor$.subscribe(av => {
      this.activeVendor = av;
      this.loadVendorOrders();
    });

    // Also watch today's orders list for updates
    this.stateService.todayOrders$.subscribe(() => {
      this.loadVendorOrders();
    });
  }

  loadVendorOrders() {
    if (!this.activeVendor) return;

    this.stateService.todayOrders$.pipe(
      map(orders => orders.filter(o => o.vendorId === this.activeVendor?.id))
    ).subscribe(orders => {
      this.vendorOrders = this.sortOrders(orders);
      this.calculateProgress();
    });
  }

  trackByOrderId(_index: number, order: Order): string {
    return order.id;
  }

  /**
   * Ordena los pedidos para que los entregados pasen automáticamente abajo.
   * Prioridad:
   * 1. route (entrega activa en curso)
   * 2. loaded (cargado en vehículo)
   * 3. pending (pendiente de carga)
   * 4. failed (falla registrada)
   * 5. delivered (entregado - al fondo)
   */
  private sortOrders(orders: Order[]): Order[] {
    const statusPriority: Record<OrderStatus, number> = {
      route: 0,
      loaded: 1,
      pending: 2,
      failed: 3,
      delivered: 4
    };

    return [...orders].sort((a, b) => {
      const pA = statusPriority[a.status] ?? 99;
      const pB = statusPriority[b.status] ?? 99;

      if (pA !== pB) {
        return pA - pB;
      }

      // Si ambos están entregados, mantener el orden en que se entregaron
      if (a.status === 'delivered' && b.status === 'delivered') {
        const timeA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : new Date(b.createdAt).getTime();
        return timeA - timeB;
      }

      // Para los demás estados, preservar orden secuencial de ruta
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }

      return (a.code || a.id).localeCompare(b.code || b.id);
    });
  }

  calculateProgress() {
    this.totalRouteCount = this.vendorOrders.length;
    this.completedRouteCount = this.vendorOrders.filter(o => o.status === 'delivered' || o.status === 'failed').length;
    this.progressPercent = this.totalRouteCount > 0 
      ? Math.round((this.completedRouteCount / this.totalRouteCount) * 100)
      : 0;
  }

  toggleExpand(orderId: string) {
    if (this.expandedOrderIds.has(orderId)) {
      this.expandedOrderIds.delete(orderId);
    } else {
      this.expandedOrderIds.add(orderId);
    }
  }

  isExpanded(orderId: string): boolean {
    return this.expandedOrderIds.has(orderId);
  }

  getClientInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  // ---- Vendor Flow Actions ----
  markLoaded(orderId: string) {
    this.stateService.updateOrderStatus(orderId, 'loaded');
  }

  startDelivery(orderId: string) {
    this.stateService.updateOrderStatus(orderId, 'route');
  }

  markDelivered(orderId: string) {
    this.expandedOrderIds.delete(orderId);
    this.stateService.updateOrderStatus(orderId, 'delivered');
  }

  openFailModal(order: Order) {
    this.failingOrder = order;
    this.failReason = 'Cliente Ausente';
    this.showFailModal = true;
  }

  closeFailModal() {
    this.showFailModal = false;
    this.failingOrder = null;
  }

  submitFalla() {
    if (!this.failingOrder) return;
    this.expandedOrderIds.delete(this.failingOrder.id);
    this.stateService.updateOrderStatus(this.failingOrder.id, 'failed', { failedReason: this.failReason });
    this.closeFailModal();
  }

  openMap(order: Order) {
    const url = order.clientLocationUrl || `https://maps.google.com/?q=${encodeURIComponent(order.clientName)}`;
    window.open(url, '_blank');
  }

  callClient(order: Order, event?: Event) {
    event?.stopPropagation();
    const phone = this.getClientPhone(order);
    if (!phone) {
      alert('El cliente no tiene un teléfono registrado.');
      return;
    }
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleanPhone}`;
  }

  getClientPhone(order: Order): string {
    if (order.clientPhone) return order.clientPhone;
    const client = this.stateService.getClientById(order.clientId);
    return client?.phone || '';
  }
}
