import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor } from '../../../core/models/types';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-vendor-reporte',
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor-reporte.component.html',
  styleUrl: './vendor-reporte.component.scss',
  standalone: true
})
export class VendorReporteComponent implements OnInit {
  private stateService = inject(StateService);

  activeVendor: Vendor | null = null;
  vendorOrders: Order[] = [];
  selectedDate = '';

  // Summary Metrics
  totalStops = 0;
  deliveredCount = 0;
  failedCount = 0;
  totalCollected = 0;
  totalCashCollected = 0;
  totalQrCollected = 0;
  efficiencyRate = 0;

  ngOnInit() {
    this.selectedDate = this.getLocalDateString();
    this.stateService.activeVendor$.subscribe(av => {
      this.activeVendor = av;
      this.loadVendorReport();
    });

    this.stateService.orders$.subscribe(() => {
      this.loadVendorReport();
    });
  }

  loadVendorReport() {
    if (!this.activeVendor) return;

    this.stateService.orders$.pipe(
      map(orders => orders.filter(o => 
        o.vendorId === this.activeVendor?.id &&
        this.getLocalDateString(new Date(o.createdAt)) === this.selectedDate
      ))
    ).subscribe(orders => {
      this.vendorOrders = orders;
      this.computeMetrics();
    });
  }

  computeMetrics() {
    this.totalStops = this.vendorOrders.length;
    const deliveredOrders = this.vendorOrders.filter(o => o.status === 'delivered');
    this.deliveredCount = deliveredOrders.length;
    this.failedCount = this.vendorOrders.filter(o => o.status === 'failed').length;
    
    this.totalCollected = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
    this.totalCashCollected = deliveredOrders
      .filter(o => !o.paymentMethod || o.paymentMethod === 'efectivo')
      .reduce((sum, o) => sum + o.total, 0);
    this.totalQrCollected = deliveredOrders
      .filter(o => o.paymentMethod === 'qr')
      .reduce((sum, o) => sum + o.total, 0);

    this.efficiencyRate = this.totalStops > 0
      ? Math.round((this.deliveredCount / this.totalStops) * 100)
      : 0;
  }

  onDateChange() {
    this.loadVendorReport();
  }

  getLocalDateString(date: Date = new Date()): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }
}
