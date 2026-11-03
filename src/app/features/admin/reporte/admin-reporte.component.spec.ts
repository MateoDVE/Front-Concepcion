import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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

  it('calcula octubre con 822 pedidos existentes sin sumar los 965 de los cierres', () => {
    const current = { pedidos_actuales_mes: 822, entregados_actuales_mes: 822, fallidos_actuales_mes: 0,
      total_ventas_sistema: 100, total_ventas_recaudado: 100, total_diferencias: 0 };
    component.groupHistoryByMonth([
      { ...current, fecha: '2026-10-01', total_pedidos: 500, total_entregados: 400, total_fallidos: 0 },
      { ...current, fecha: '2026-10-02', total_pedidos: 465, total_entregados: 422, total_fallidos: 2 }
    ]);
    expect(component.monthlySummaries[0]).toEqual(jasmine.objectContaining({
      totalOrders: 822, totalDelivered: 822, totalFailed: 0, efficiencyRate: 100,
      totalSistema: 200, totalRecaudado: 200
    }));
  });

  it('no revive pedidos eliminados aunque existan cierres guardados', () => {
    component.groupHistoryByMonth([{ fecha: '2026-09-01', total_pedidos: 50, total_entregados: 40,
      total_fallidos: 10, pedidos_actuales_mes: 0, entregados_actuales_mes: 0,
      fallidos_actuales_mes: 0, total_ventas_sistema: 400, total_ventas_recaudado: 400, total_diferencias: 0 }]);
    expect(component.monthlySummaries[0].totalOrders).toBe(0);
    expect(component.monthlySummaries[0].efficiencyRate).toBe(0);
    expect(component.monthlySummaries[0].totalRecaudado).toBe(400);
  });

  it('cuenta pendientes actuales y convierte valores numéricos recibidos como texto', () => {
    component.groupHistoryByMonth([{ fecha: '2026-11-01', pedidos_actuales_mes: '10',
      entregados_actuales_mes: '8', fallidos_actuales_mes: '1',
      total_ventas_sistema: 0, total_ventas_recaudado: 0, total_diferencias: 0 }]);
    expect(component.monthlySummaries[0].totalOrders).toBe(10);
    expect(component.monthlySummaries[0].efficiencyRate).toBe(80);
  });

  it('no muestra 100 por ciento cuando todavía faltan entregas', () => {
    component.groupHistoryByMonth([{ fecha: '2026-09-01', pedidos_actuales_mes: 685,
      entregados_actuales_mes: 683, fallidos_actuales_mes: 2,
      total_ventas_sistema: 0, total_ventas_recaudado: 0, total_diferencias: 0 }]);
    expect(component.monthlySummaries[0].efficiencyRate).toBe(99.71);
  });

  it('carga octubre desde pedidos actuales aunque el servidor no envíe los campos nuevos', () => {
    const state = TestBed.inject(StateService);
    state.getHistoryReport = () => of([{ fecha: '2026-10-01', total_pedidos: 965,
      total_entregados: 822, total_ventas_sistema: 100, total_ventas_recaudado: 100, total_diferencias: 0 }]);
    state.fetchOrders = () => of(Array.from({ length: 822 }, (_, i) => order('2026-10-03T12:00:00Z', `order-${i}`)));
    component.fetchMonthlyReport();
    expect(component.monthlySummaries[0].totalOrders).toBe(822);
    expect(component.monthlySummaries[0].totalDelivered).toBe(822);
    expect(component.monthlySummaries[0].efficiencyRate).toBe(100);
    expect(component.monthlyLoading).toBeFalse();
  });

  it('no muestra cero como si fuera un resultado cuando falla la consulta de pedidos', () => {
    const state = TestBed.inject(StateService);
    state.getHistoryReport = () => of([]);
    state.fetchOrders = () => throwError(() => new Error('sin conexión'));
    spyOn(console, 'error');
    const feedback = spyOn(component, 'openFeedbackModal');
    component.fetchMonthlyReport();
    expect(component.monthlySummaries).toEqual([]);
    expect(component.monthlyLoading).toBeFalse();
    expect(feedback).toHaveBeenCalled();
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
