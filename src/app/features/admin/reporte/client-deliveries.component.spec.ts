import { ClientDeliveriesComponent } from './client-deliveries.component';
import { Order } from '../../../core/models/types';

describe('ClientDeliveriesComponent', () => {
  let component: ClientDeliveriesComponent;
  const order = (overrides: Partial<Order> = {}): Order => ({
    id: 'order-1', clientId: 'client-1', clientName: 'Ana', vendorId: null, vendorName: null,
    status: 'delivered', createdAt: '2026-09-28T12:00:00Z', deliveredAt: '2026-10-08T16:00:00Z',
    items: [{ productId: 'water', name: 'Agua 20 L', quantity: 2, price: 10 }], total: 20,
    ...overrides
  });

  beforeEach(() => {
    component = new ClientDeliveriesComponent();
    component.selectedMonth = '2026-10';
    component.selectedClientId = 'client-1';
  });

  it('counts delivered orders once and sums their products for the selected client', () => {
    component.orders = [order(), order({ id: 'order-2', items: [
      { productId: 'water', name: 'Agua 20 L', quantity: 3, price: 10 },
      { productId: 'bottle', name: 'Botella', quantity: 1, price: 5 }
    ] }), order({ id: 'other', clientId: 'client-2' }), order({ status: 'failed' }), order({ status: 'pending' })];
    component.ngOnChanges();
    expect(component.deliveries.length).toBe(2);
    expect(component.productTotals.find(product => product.id === 'water')?.quantity).toBe(5);
    expect(component.productTotals.find(product => product.id === 'bottle')?.quantity).toBe(1);
  });

  it('uses the delivery month in Bolivia, including UTC month boundaries', () => {
    component.orders = [order({ id: 'september', deliveredAt: '2026-10-01T02:00:00Z' }),
      order({ id: 'october', deliveredAt: '2026-11-01T02:00:00Z' })];
    component.ngOnChanges();
    expect(component.deliveries.map(entry => entry.order.id)).toEqual(['october']);
    expect(component.deliveries[0].date).toBe('2026-10-31');
  });

  it('excludes missing or invalid delivery dates and different years', () => {
    component.orders = [order({ deliveredAt: null }), order({ deliveredAt: 'invalid' }),
      order({ deliveredAt: '2025-10-08T16:00:00Z' })];
    component.ngOnChanges();
    expect(component.deliveries).toEqual([]);
    expect(component.productTotals).toEqual([]);
  });

  it('clears totals when changing to a client without deliveries or clearing the month', () => {
    component.orders = [order()];
    component.ngOnChanges();
    component.selectedClientId = 'no-deliveries';
    component.updateReport();
    expect(component.deliveries).toEqual([]);
    expect(component.productTotals).toEqual([]);
    component.selectedClientId = 'client-1';
    component.selectedMonth = '';
    component.updateReport();
    expect(component.deliveries).toEqual([]);
  });

  it('keeps clients with no orders and distinguishes clients with the same name by ID', () => {
    component.clients = [{ id: 'no-orders', name: 'Ana', phone: '123', address: '', locationUrl: '' }];
    component.orders = [order(), order({ id: 'second', clientId: 'client-2' })];
    component.ngOnChanges();
    expect(component.clientOptions.length).toBe(3);
    expect(component.deliveries.length).toBe(1);
  });
});
