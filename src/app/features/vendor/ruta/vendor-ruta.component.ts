import { Component, DestroyRef, PLATFORM_ID, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, interval } from 'rxjs';
import { compareRouteOrders } from '../../../core/models/route-order';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor, OrderStatus } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';


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

  // Selected Order for Delivery Modal (Payment Selection)
  deliveringOrder: Order | null = null;
  selectedPaymentMethod: 'efectivo' | 'qr' = 'efectivo';
  showDeliverModal = false;

  // Track expanded cards
  expandedOrderIds = new Set<string>();

  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    combineLatest([this.stateService.activeVendor$, this.stateService.todayOrders$])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([vendor, orders]) => {
        this.activeVendor = vendor;
        this.vendorOrders = vendor ? orders.filter(o => o.vendorId === vendor.id).sort(compareRouteOrders) : [];
        this.calculateProgress();
      });
    if (isPlatformBrowser(this.platformId)) {
      this.stateService.loadTodayOrders();
      interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        if (typeof document === 'undefined' || !document.hidden) {
          this.stateService.loadTodayOrders();
        }
      });
    }
  }

  refreshRoute() {
    this.stateService.loadTodayOrders();
  }

  trackByOrderId(_index: number, order: Order): string {
    return order.id;
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

  openDeliverModal(order: Order, event?: Event) {
    event?.stopPropagation();
    this.deliveringOrder = order;
    this.selectedPaymentMethod = 'efectivo';
    this.showDeliverModal = true;
  }

  closeDeliverModal() {
    this.showDeliverModal = false;
    this.deliveringOrder = null;
  }

  selectPaymentMethod(method: 'efectivo' | 'qr') {
    this.selectedPaymentMethod = method;
  }

  confirmDelivery() {
    if (!this.deliveringOrder) return;
    this.expandedOrderIds.delete(this.deliveringOrder.id);
    this.stateService.updateOrderStatus(this.deliveringOrder.id, 'delivered', {
      paymentMethod: this.selectedPaymentMethod
    });
    this.closeDeliverModal();
  }

  markDelivered(orderId: string) {
    const order = this.vendorOrders.find(o => o.id === orderId);
    if (order) {
      this.openDeliverModal(order);
    } else {
      this.expandedOrderIds.delete(orderId);
      this.stateService.updateOrderStatus(orderId, 'delivered', { paymentMethod: 'efectivo' });
    }
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
