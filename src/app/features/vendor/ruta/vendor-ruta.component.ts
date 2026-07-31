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

    // Also watch orders list for updates
    this.stateService.orders$.subscribe(() => {
      this.loadVendorOrders();
    });
  }

  loadVendorOrders() {
    if (!this.activeVendor) return;

    this.stateService.orders$.pipe(
      map(orders => orders.filter(o => o.vendorId === this.activeVendor?.id))
    ).subscribe(orders => {
      this.vendorOrders = orders;
      this.calculateProgress();
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
    this.stateService.updateOrderStatus(this.failingOrder.id, 'failed', { failedReason: this.failReason });
    this.closeFailModal();
  }

  openMap(address: string) {
    const url = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  }
}
