import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../../core/services/state.service';
import { Order, Product } from '../../../core/models/types';

interface ProductSummary {
  productId: string;
  name: string;
  quantitySold: number;
  totalRevenue: number;
  unit: string;
}

interface MonthlySummary {
  monthKey: string;     // e.g. "2026-07"
  monthName: string;    // e.g. "Julio 2026"
  daysCount: number;
  totalOrders: number;
  totalDelivered: number;
  totalFailed: number;
  totalSistema: number;
  totalRecaudado: number;
  totalDiferencia: number;
  efficiencyRate: number;
  isExpanded: boolean;
  dailyClosures: any[];
}

@Component({
  selector: 'app-admin-reporte',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reporte.component.html',
  styleUrl: './admin-reporte.component.scss',
  standalone: true
})
export class AdminReporteComponent implements OnInit {
  private stateService = inject(StateService);

  // Tab State
  activeTab: 'today' | 'history' | 'monthly' = 'today';
  isTodayClosed = false;

  // --- Tab 1: Today's closing (open day) ---
  orders: Order[] = [];
  products: Product[] = [];
  totalOrders = 0;
  deliveredCount = 0;
  failedCount = 0;
  pendingCount = 0;
  totalCollected = 0;
  efficiencyRate = 0;
  failedOrders: Order[] = [];
  productSummaries: ProductSummary[] = [];

  // --- Tab 2: Historical Day ---
  historyDate = this.getLocalDateString();
  historyLoading = false;
  historyReportData: any[] = []; // Desglose por vendedor from API
  historyTotalOrders = 0;
  historyDeliveredCount = 0;
  historyFailedCount = 0;
  historyPendingCount = 0;
  historyTotalCollected = 0;
  historyTotalSistema = 0;
  historyDifference = 0;
  historyEfficiencyRate = 0;
  historyFailedOrders: Order[] = [];
  historyProductSummaries: ProductSummary[] = [];

  // --- Tab 3: Monthly report ---
  monthlyLoading = false;
  monthlyRecords: any[] = []; // Raw history records from /closings/report/history
  monthlySummaries: MonthlySummary[] = [];

  ngOnInit() {
    this.checkIfTodayIsClosed();
    this.stateService.products$.subscribe(p => {
      this.products = p;
      this.computeTodayReport();
      // If we are on historical tab, re-compute historical data
      if (this.activeTab === 'history') {
        this.computeHistoricalOrdersSummary();
      }
    });

    this.stateService.orders$.subscribe(orders => {
      this.orders = orders;
      this.computeTodayReport();
      // If we are on historical tab, re-compute historical data
      if (this.activeTab === 'history') {
        this.computeHistoricalOrdersSummary();
      }
    });
  }

  selectTab(tab: 'today' | 'history' | 'monthly') {
    this.activeTab = tab;
    if (tab === 'history') {
      this.fetchDailyHistory();
    } else if (tab === 'monthly') {
      this.fetchMonthlyReport();
    }
  }

  // --- Logic for Tab 1 (Today) ---
  computeTodayReport() {
    // Filter only today's orders for the active (open) day
    const todayStr = this.getLocalDateString();
    const todayOrders = this.orders.filter(o => o.createdAt.startsWith(todayStr));

    this.totalOrders = todayOrders.length;
    this.deliveredCount = todayOrders.filter(o => o.status === 'delivered').length;
    this.failedCount = todayOrders.filter(o => o.status === 'failed').length;
    this.pendingCount = todayOrders.filter(o => o.status === 'pending' || o.status === 'loaded' || o.status === 'route').length;
    
    this.totalCollected = todayOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0);

    this.efficiencyRate = this.totalOrders > 0 
      ? Math.round((this.deliveredCount / this.totalOrders) * 100) 
      : 0;

    this.failedOrders = todayOrders.filter(o => o.status === 'failed');

    const salesMap = new Map<string, { quantity: number; revenue: number }>();
    todayOrders
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
    }).filter(s => s.quantitySold > 0);
  }

  checkIfTodayIsClosed() {
    if (typeof window === 'undefined') return;
    const todayStr = this.getLocalDateString();
    this.stateService.getHistoryReport().subscribe({
      next: (data) => {
        this.isTodayClosed = data.some(r => r.fecha.startsWith(todayStr) && r.tipo_registro === 'CERRADO');
      },
      error: (err) => console.error('Error checking if today is closed', err)
    });
  }

  closeDay() {
    if (confirm('¿Deseas realizar el Cierre de Jornada? Esto consolidará las ventas del día y registrará los cierres de caja correspondientes en el sistema.')) {
      this.stateService.resetData().subscribe({
        next: () => {
          alert('Jornada consolidada con éxito.');
          this.checkIfTodayIsClosed();
          location.reload();
        },
        error: (err) => {
          console.error('Error al realizar el cierre', err);
          alert('Hubo un error al realizar el cierre. Por favor verifica la consola.');
        }
      });
    }
  }

  // --- Logic for Tab 2 (Historical Day) ---
  onDateChange() {
    this.fetchDailyHistory();
  }

  fetchDailyHistory() {
    this.historyLoading = true;
    this.stateService.getDailyReport(this.historyDate).subscribe({
      next: (data) => {
        this.historyReportData = data;
        
        // Find general metrics in monthlyRecords if loaded
        const record = this.monthlyRecords.find(r => r.fecha.startsWith(this.historyDate));
        if (record) {
          this.historyTotalOrders = record.total_pedidos;
          this.historyDeliveredCount = record.total_entregados;
          this.historyFailedCount = record.total_fallidos;
          this.historyTotalSistema = Number(record.total_ventas_sistema);
          this.historyTotalCollected = Number(record.total_ventas_recaudado);
          this.historyDifference = Number(record.total_diferencias);
          this.historyEfficiencyRate = Number(record.porcentaje_efectividad);
          this.historyPendingCount = 0;
        } else {
          // If not in historical list, summarize from the breakdown returned
          this.historyTotalOrders = data.reduce((sum, item) => sum + item.total_pedidos, 0);
          this.historyDeliveredCount = data.reduce((sum, item) => sum + item.entregados, 0);
          this.historyFailedCount = data.reduce((sum, item) => sum + item.fallidos, 0);
          this.historyPendingCount = data.reduce((sum, item) => sum + item.pendientes + item.en_ruta, 0);
          
          this.historyTotalSistema = data.reduce((sum, item) => sum + Number(item.total_sistema_entregado), 0);
          
          // If it's a closed day but we didn't match the summary yet, check if there is closing data in the breakdown
          const hasClosedData = data.some(item => Number(item.total_recaudado) !== Number(item.total_sistema_entregado) || Number(item.diferencia) !== 0);
          
          if (hasClosedData) {
            this.historyTotalCollected = data.reduce((sum, item) => sum + Number(item.total_recaudado), 0);
            this.historyDifference = data.reduce((sum, item) => sum + Number(item.diferencia), 0);
          } else {
            this.historyTotalCollected = this.historyTotalSistema;
            this.historyDifference = 0;
          }

          this.historyEfficiencyRate = this.historyTotalOrders > 0
            ? Math.round((this.historyDeliveredCount / this.historyTotalOrders) * 100)
            : 0;
        }

        // Compute products and incidents for this date from the in-memory orders
        this.computeHistoricalOrdersSummary();
        this.historyLoading = false;
      },
      error: (err) => {
        console.error('Error fetching daily report', err);
        this.historyLoading = false;
      }
    });
  }

  computeHistoricalOrdersSummary() {
    const histOrders = this.orders.filter(o => o.createdAt.startsWith(this.historyDate));
    this.historyFailedOrders = histOrders.filter(o => o.status === 'failed');

    const salesMap = new Map<string, { quantity: number; revenue: number }>();
    histOrders
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

    this.historyProductSummaries = this.products.map(prod => {
      const sales = salesMap.get(prod.id) || { quantity: 0, revenue: 0 };
      return {
        productId: prod.id,
        name: prod.name,
        quantitySold: sales.quantity,
        totalRevenue: sales.revenue,
        unit: prod.unit
      };
    }).filter(s => s.quantitySold > 0);
  }

  // --- Logic for Tab 3 (Monthly) ---
  fetchMonthlyReport() {
    this.monthlyLoading = true;
    this.stateService.getHistoryReport().subscribe({
      next: (data) => {
        this.monthlyRecords = data;
        this.groupHistoryByMonth(data);
        this.monthlyLoading = false;
      },
      error: (err) => {
        console.error('Error fetching history report', err);
        this.monthlyLoading = false;
      }
    });
  }

  groupHistoryByMonth(records: any[]) {
    const monthsMap = new Map<string, any[]>();
    
    records.forEach(rec => {
      const datePart = rec.fecha.split('T')[0];
      const monthKey = datePart.substring(0, 7); // "YYYY-MM"
      const currentList = monthsMap.get(monthKey) || [];
      currentList.push(rec);
      monthsMap.set(monthKey, currentList);
    });

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const summaries: MonthlySummary[] = [];

    monthsMap.forEach((monthRecords, monthKey) => {
      const [year, month] = monthKey.split('-');
      const monthIdx = parseInt(month, 10) - 1;
      const monthName = `${monthNames[monthIdx]} ${year}`;

      const daysCount = monthRecords.length;
      const totalOrders = monthRecords.reduce((sum, r) => sum + r.total_pedidos, 0);
      const totalDelivered = monthRecords.reduce((sum, r) => sum + r.total_entregados, 0);
      const totalFailed = monthRecords.reduce((sum, r) => sum + r.total_fallidos, 0);
      const totalSistema = monthRecords.reduce((sum, r) => sum + Number(r.total_ventas_sistema), 0);
      const totalRecaudado = monthRecords.reduce((sum, r) => sum + Number(r.total_ventas_recaudado), 0);
      const totalDiferencia = monthRecords.reduce((sum, r) => sum + Number(r.total_diferencias), 0);
      
      const efficiencyRate = totalOrders > 0
        ? Math.round((totalDelivered / totalOrders) * 100)
        : 0;

      summaries.push({
        monthKey,
        monthName,
        daysCount,
        totalOrders,
        totalDelivered,
        totalFailed,
        totalSistema,
        totalRecaudado,
        totalDiferencia,
        efficiencyRate,
        isExpanded: false,
        dailyClosures: monthRecords.sort((a, b) => b.fecha.localeCompare(a.fecha))
      });
    });

    // Sort months descending
    this.monthlySummaries = summaries.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }

  toggleMonth(summary: MonthlySummary) {
    summary.isExpanded = !summary.isExpanded;
  }

  viewDayDetails(dateStr: string) {
    this.historyDate = dateStr.split('T')[0];
    this.activeTab = 'history';
    this.fetchDailyHistory();
  }

  toNumber(value: any): number {
    return Number(value || 0);
  }

  // --- General Helpers ---
  getLocalDateString(date: Date = new Date()): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }
}
