import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Vendor } from '../../../core/models/types';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-vendor-reporte',
  imports: [CommonModule],
  templateUrl: './vendor-reporte.component.html',
  styleUrl: './vendor-reporte.component.scss',
  standalone: true
})
export class VendorReporteComponent implements OnInit {
  private stateService = inject(StateService);

  activeVendor: Vendor | null = null;
  vendorOrders: Order[] = [];

  // Summary Metrics
  totalStops = 0;
  deliveredCount = 0;
  failedCount = 0;
  totalCollected = 0;
  efficiencyRate = 0;

  ngOnInit() {
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
      map(orders => orders.filter(o => o.vendorId === this.activeVendor?.id))
    ).subscribe(orders => {
      this.vendorOrders = orders;
      this.computeMetrics();
    });
  }

  computeMetrics() {
    this.totalStops = this.vendorOrders.length;
    this.deliveredCount = this.vendorOrders.filter(o => o.status === 'delivered').length;
    this.failedCount = this.vendorOrders.filter(o => o.status === 'failed').length;
    
    this.totalCollected = this.vendorOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0);

    this.efficiencyRate = this.totalStops > 0
      ? Math.round((this.deliveredCount / this.totalStops) * 100)
      : 0;
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }
}
