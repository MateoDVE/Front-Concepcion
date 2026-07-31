import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor, OrderStatus } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-vendor-entregas',
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-entregas.component.html',
  styleUrl: './vendor-entregas.component.scss',
  standalone: true
})
export class VendorEntregasComponent implements OnInit {
  private stateService = inject(StateService);

  activeVendor: Vendor | null = null;
  completedOrders: Order[] = [];
  filteredOrders: Order[] = [];
  searchQuery = '';

  ngOnInit() {
    this.stateService.activeVendor$.subscribe(av => {
      this.activeVendor = av;
      this.loadCompletedOrders();
    });

    this.stateService.orders$.subscribe(() => {
      this.loadCompletedOrders();
    });
  }

  loadCompletedOrders() {
    if (!this.activeVendor) return;

    this.stateService.orders$.pipe(
      map(orders => orders.filter(o => 
        o.vendorId === this.activeVendor?.id && 
        (o.status === 'delivered' || o.status === 'failed')
      ))
    ).subscribe(orders => {
      this.completedOrders = orders;
      this.applySearch();
    });
  }

  onSearchChange() {
    this.applySearch();
  }

  applySearch() {
    if (!this.searchQuery.trim()) {
      this.filteredOrders = this.completedOrders;
      return;
    }

    const q = this.searchQuery.toLowerCase();
    this.filteredOrders = this.completedOrders.filter(o => 
      o.clientName.toLowerCase().includes(q) || 
      o.id.toLowerCase().includes(q)
    );
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
    return status === 'delivered' ? 'Entregado' : 'Fallido';
  }

  getStatusBadgeClass(status: OrderStatus): string {
    return `badge--${status}`;
  }
}
