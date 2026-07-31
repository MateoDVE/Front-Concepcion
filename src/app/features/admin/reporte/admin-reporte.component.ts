import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../../core/services/state.service';
import { Order, Product } from '../../../core/models/types';
import { map } from 'rxjs/operators';

interface ProductSummary {
  productId: string;
  name: string;
  quantitySold: number;
  totalRevenue: number;
  unit: string;
}

@Component({
  selector: 'app-admin-reporte',
  imports: [CommonModule],
  templateUrl: './admin-reporte.component.html',
  styleUrl: './admin-reporte.component.scss',
  standalone: true
})
export class AdminReporteComponent implements OnInit {
  private stateService = inject(StateService);

  orders: Order[] = [];
  products: Product[] = [];

  // Summary Metrics
  totalOrders = 0;
  deliveredCount = 0;
  failedCount = 0;
  pendingCount = 0;
  totalCollected = 0;
  efficiencyRate = 0;

  failedOrders: Order[] = [];
  productSummaries: ProductSummary[] = [];

  ngOnInit() {
    this.stateService.products$.subscribe(p => {
      this.products = p;
      this.computeReport();
    });

    this.stateService.orders$.subscribe(orders => {
      this.orders = orders;
      this.computeReport();
    });
  }

  computeReport() {
    if (this.orders.length === 0) return;

    this.totalOrders = this.orders.length;
    this.deliveredCount = this.orders.filter(o => o.status === 'delivered').length;
    this.failedCount = this.orders.filter(o => o.status === 'failed').length;
    this.pendingCount = this.orders.filter(o => o.status === 'pending' || o.status === 'loaded' || o.status === 'route').length;
    
    this.totalCollected = this.orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0);

    this.efficiencyRate = this.totalOrders > 0 
      ? Math.round((this.deliveredCount / this.totalOrders) * 100) 
      : 0;

    // Filter failed orders with reasons
    this.failedOrders = this.orders.filter(o => o.status === 'failed');

    // Compute sales per product
    const salesMap = new Map<string, { quantity: number; revenue: number }>();
    
    this.orders
      .filter(o => o.status === 'delivered')
      .forEach(order => {
        order.items.forEach(item => {
          const current = salesMap.get(item.productId) || { quantity: 0, revenue: 0 };
          salesMap.set(item.productId, {
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + (item.quantity * item.price)
          });
        });
      });

    this.productSummaries = this.products.map(prod => {
      const sales = salesMap.get(prod.id) || { quantity: 0, revenue: 0 };
      return {
        productId: prod.id,
        name: prod.name,
        quantitySold: sales.quantity,
        totalRevenue: sales.revenue,
        unit: prod.unit
      };
    }).filter(s => s.quantitySold > 0); // Only show products that had sales
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  closeDay() {
    if (confirm('¿Deseas realizar el Cierre de Jornada? Esto consolidará las ventas del día y reiniciará la simulación de ruta para mañana.')) {
      this.stateService.resetData();
      alert('Jornada consolidada con éxito. Los datos se han reiniciado para el siguiente día.');
      location.reload();
    }
  }
}
