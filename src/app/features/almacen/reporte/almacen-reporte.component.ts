import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { AuthService } from '../../../core/services/auth.service';
import { Observable } from 'rxjs';

interface ProductionLog {
  id: string;
  producto_id: string;
  cantidad: number;
  usuario_id: string;
  created_at: string;
  producto: {
    nombre: string;
    unidad: string;
  };
  usuario: {
    nombre: string;
  };
}

interface ProductSummary {
  name: string;
  unit: string;
  total: number;
}

@Component({
  selector: 'app-almacen-reporte',
  imports: [CommonModule, FormsModule],
  templateUrl: './almacen-reporte.component.html',
  styleUrl: './almacen-reporte.component.scss',
  standalone: true
})
export class AlmacenReporteComponent implements OnInit {
  private stateService = inject(StateService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  selectedDate = '';
  logs: ProductionLog[] = [];
  isLoading = false;

  // Summarized metrics
  totalLogsCount = 0;
  totalUnitsAdded = 0;
  productSummaries: ProductSummary[] = [];

  ngOnInit() {
    // Default to today's date in local YYYY-MM-DD
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    this.selectedDate = localToday.toISOString().split('T')[0];

    this.loadReport();
  }

  onDateChange() {
    this.loadReport();
  }

  loadReport() {
    if (!this.selectedDate) return;
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.authService.isLoggedIn) return;

    this.isLoading = true;
    this.stateService.getProductionReport(this.selectedDate).subscribe({
      next: (data: any[]) => {
        this.logs = data;
        this.calculateMetrics();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading production report', err);
        this.isLoading = false;
      }
    });
  }

  private calculateMetrics() {
    this.totalLogsCount = this.logs.length;
    this.totalUnitsAdded = this.logs.reduce((sum, log) => sum + log.cantidad, 0);

    // Group by product
    const summariesMap = new Map<string, { total: number; unit: string }>();
    this.logs.forEach(log => {
      const prodName = log.producto.nombre;
      const current = summariesMap.get(prodName) || { total: 0, unit: log.producto.unidad };
      current.total += log.cantidad;
      summariesMap.set(prodName, current);
    });

    this.productSummaries = Array.from(summariesMap.entries()).map(([name, val]) => ({
      name,
      unit: val.unit,
      total: val.total
    }));
  }

  formatTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
