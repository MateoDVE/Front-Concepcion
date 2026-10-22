import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminReporteComponent } from './admin-reporte.component';
import { StateService } from '../../../core/services/state.service';
import { ExcelExportService } from '../../../core/services/excel-export.service';
import { Order } from '../../../core/models/types';

describe('AdminReporteComponent: fechas de jornada', () => {
  let component: AdminReporteComponent;
  let excel: ExcelExportService;
  const order = (createdAt: string, id = 'night'): Order => ({
    id, clientId: 'client', clientName: 'Cliente', vendorId: null, vendorName: null,
    status: 'delivered', createdAt, deliveredAt: createdAt, paymentMethod: 'efectivo',
    total: 20, items: [{ productId: 'water', name: 'Agua', quantity: 2, price: 10 }]
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: StateService, useValue: { clients$: of([]) } }, ExcelExportService]
    });
    excel = TestBed.inject(ExcelExportService);
    component = TestBed.runInInjectionContext(() => new AdminReporteComponent());
    component.products = [{ id: 'water', name: 'Agua', basePrice: 10, stock: 100, unit: 'bidón' }];
  });

  it('incluye las entregas nocturnas solo el 2 de octubre y no duplica productos ni cobros el 3', () => {
    // Fechas sintéticas: 20:00 a 23:59 del 2 de octubre en Bolivia.
    component.orders = ['00:00:00', '01:00:00', '02:00:00', '03:59:59'].map((time, i) =>
      order(`2026-10-03T${time}Z`, `night-${i}`));
    component.historyDate = '2026-10-02';
    component.computeHistoricalOrdersSummary();
    expect(component.historyDeliveredOrders.length).toBe(4);
    expect(component.historyCashTotal).toBe(80);
    expect(component.historyProductSummaries[0].quantitySold).toBe(8);
    component.historyDate = '2026-10-03';
    component.computeHistoricalOrdersSummary();
    expect(component.historyDeliveredOrders).toEqual([]);
    expect(component.historyCashTotal).toBe(0);
    expect(component.historyProductSummaries).toEqual([]);
  });

  it('separa exactamente la medianoche de Bolivia', () => {
    component.orders = [order('2026-10-03T03:59:59.999Z', 'before'), order('2026-10-03T04:00:00Z', 'after')];
    component.historyDate = '2026-10-03';
    component.computeHistoricalOrdersSummary();
    expect(component.historyDeliveredOrders.map(o => o.id)).toEqual(['after']);
  });

  it('exporta cada pedido en un solo día', () => {
    const exported = spyOn(excel, 'exportDailyReport');
    component.orders = [order('2026-10-03T02:00:00Z')];
    component.historyDate = '2026-10-02';
    component.exportHistoricalDay();
    expect(exported.calls.mostRecent().args[1]).toEqual(component.orders);
    component.historyDate = '2026-10-03';
    component.exportHistoricalDay();
    expect(exported.calls.mostRecent().args[1]).toEqual([]);
  });

  it('exporta el último pedido nocturno del mes únicamente en su mes de Bolivia', () => {
    const exported = spyOn(excel, 'exportMonth');
    component.orders = [order('2026-11-01T02:00:00Z')];
    component.groupHistoryByMonth([]);
    const month = { monthKey: '2026-10', monthName: 'Octubre', daysCount: 0, totalOrders: 0,
      totalDelivered: 0, totalFailed: 0, totalSistema: 0, totalRecaudado: 0,
      totalDiferencia: 0, efficiencyRate: 0, isExpanded: false, dailyClosures: [] };
    component.exportCurrentMonth(month);
    expect(exported.calls.mostRecent().args[1]).toEqual(component.orders);
    component.exportCurrentMonth({ ...month, monthKey: '2026-11' });
    expect(exported.calls.mostRecent().args[1]).toEqual([]);
  });

  it('usa Bolivia independientemente del dispositivo y conserva fechas de calendario', () => {
    expect(excel.formatDate('2026-10-03T02:00:00Z')).toBe('2026-10-02');
    expect(excel.formatDate('2026-10-02T22:00:00-04:00')).toBe('2026-10-02');
    expect(excel.formatDate('2026-10-02')).toBe('2026-10-02');
    expect(excel.formatDate('invalid')).toBe('');
    expect(excel.formatDate(null)).toBe('');
    expect(component.getLocalDateString(new Date('2026-10-03T02:00:00Z'))).toBe('2026-10-02');
  });
});
