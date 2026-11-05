import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AdminCrearPedidoComponent } from './admin-crear-pedido.component';
import { StateService } from '../../../core/services/state.service';
import { Order } from '../../../core/models/types';

describe('Order save lifecycle', () => {
  let component: AdminCrearPedidoComponent;
  let response: Subject<Order>;
  let state: any;
  const existing = { id: 'order', clientId: 'client', clientName: 'Cliente', status: 'loaded',
    createdAt: '2026-11-01T20:00:00Z', scheduledDate: '2026-11-09',
    description: 'Original', items: [{ productId: 'water', name: 'Agua', price: 10, quantity: 2 }] } as Order;

  beforeEach(() => {
    response = new Subject<Order>();
    state = {
      createOrder: jasmine.createSpy().and.returnValue(response),
      updateOrder: jasmine.createSpy().and.returnValue(response),
      fetchOrder: jasmine.createSpy().and.returnValue(of(existing)),
      loadSpecialPricesForClient: () => of([]),
      getOrderDate: (order: Order) => order.scheduledDate,
      getLocalDateString: () => '2026-11-03'
    };
    TestBed.configureTestingModule({ providers: [
      { provide: StateService, useValue: state },
      { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      { provide: ActivatedRoute, useValue: {} }
    ] });
    component = TestBed.runInInjectionContext(() => new AdminCrearPedidoComponent());
    component.selectedClient = { id: 'client', name: 'Cliente' } as any;
    component.orderItems = [{ productId: 'water', name: 'Agua', quantity: 2, price: 10, basePrice: 10 }];
    component.deliveryDate = '2026-11-09';
  });

  it('waits for confirmation and ignores repeated clicks while saving', () => {
    component.saveOrder(); component.saveOrder();
    expect(state.createOrder).toHaveBeenCalledTimes(1);
    expect(component.saving).toBeTrue();
    expect(component.showFeedbackModal).toBeFalse();
    expect(state.createOrder.calls.mostRecent().args[0].scheduledDate).toBe('2026-11-09');
    response.next(existing); response.complete();
    expect(component.feedbackTone).toBe('success');
    expect(component.saving).toBeFalse();
  });

  it('keeps the form and shows an error when the request fails', () => {
    component.description = 'Llamar antes de llegar';
    component.saveOrder(); response.error({ status: 500 });
    expect(component.feedbackTone).toBe('error');
    expect(component.description).toBe('Llamar antes de llegar');
    expect(component.orderItems.length).toBe(1);
    expect(component.saving).toBeFalse();
  });

  it('loads once and preserves the original status and creation date when editing', () => {
    component.loadOrderData('order', false);
    expect(component.deliveryDate).toBe('2026-11-09');
    component.description = 'Editado'; component.saveOrder();
    expect(state.updateOrder).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 'loaded', createdAt: existing.createdAt, scheduledDate: '2026-11-09', description: 'Editado'
    }));
  });

  it('rejects fractional quantities before contacting the API', () => {
    component.orderItems[0].quantity = 1.5; component.saveOrder();
    expect(state.createOrder).not.toHaveBeenCalled();
  });

  for (const status of ['loaded', 'route'] as const) {
    it(`edits quantities and reassigns a ${status} order while preserving its status`, () => {
      state.fetchOrder.and.returnValue(of({ ...existing, status, vendorId: 'old-vendor' }));
      component.loadOrderData('order', false);
      component.vendors = [{ id: 'new-vendor', name: 'Nuevo vendedor', phone: '', avatar: 'NV', active: true }];
      component.selectedVendorId = 'new-vendor';
      component.orderItems[0].quantity = 5;
      component.calculateTotal();
      component.saveOrder();
      expect(state.updateOrder).toHaveBeenCalledWith(jasmine.objectContaining({
        status, vendorId: 'new-vendor', vendorName: 'Nuevo vendedor', total: 50,
        items: [jasmine.objectContaining({ quantity: 5, price: 10 })]
      }));
      expect(state.createOrder).not.toHaveBeenCalled();
    });
  }
  it('combines repeated products and preserves the total when creating', () => {
    component.orderItems.push({ ...component.orderItems[0], quantity: 3 });
    component.saveOrder();
    expect(component.orderItems.length).toBe(1);
    expect(state.createOrder).toHaveBeenCalledWith(jasmine.objectContaining({
      items: [{ productId: 'water', name: 'Agua', quantity: 5, price: 10 }], total: 50
    }));
  });
  it('combines repeated products when editing without changing the status', () => {
    component.loadOrderData('order', false);
    component.orderItems.push({ ...component.orderItems[0], quantity: 1 });
    component.saveOrder();
    expect(state.updateOrder).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 'loaded', items: [{ productId: 'water', name: 'Agua', quantity: 3, price: 10 }], total: 30
    }));
  });
  it('preserves the form and blocks conflicting prices instead of changing the charge', () => {
    component.orderItems.push({ ...component.orderItems[0], price: 12 });
    component.saveOrder();
    expect(state.createOrder).not.toHaveBeenCalled();
    expect(component.orderItems.length).toBe(2);
    expect(component.feedbackTitle).toBe('Producto con precios distintos');
  });
  it('shows validation errors returned by the server', () => {
    component.saveOrder();
    response.error({ status: 400, error: { message: ['Producto repetido'] } });
    expect(component.feedbackMessage).toBe('Producto repetido');
  });
});
