import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { StateService } from '../../../core/services/state.service';
import { AdminCrearPedidoComponent } from './admin-crear-pedido.component';

describe('Order description form', () => {
  let component: AdminCrearPedidoComponent;
  let state: any;
  beforeEach(() => {
    state = {
      createOrder: jasmine.createSpy().and.returnValue(of({})), updateOrder: jasmine.createSpy().and.returnValue(of({})),
      getLocalDateString: () => '2026-11-03', getOrderDate: () => '2026-11-03',
      fetchOrder: () => of({ id: 'order', clientId: 'client', clientName: 'Cliente', items: [{ productId: 'product', name: 'Agua', quantity: 1, price: 10 }], description: 'Llamar al llegar', status: 'pending' }),
      orders$: of([{ id: 'order', clientId: 'client', items: [], description: 'Llamar al llegar' }]),
      loadSpecialPricesForClient: () => of([]),
    };
    TestBed.configureTestingModule({ providers: [
      { provide: StateService, useValue: state },
      { provide: Router, useValue: {} },
      { provide: ActivatedRoute, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new AdminCrearPedidoComponent());
    component.deliveryDate = '2026-11-03';
    component.selectedClient = { id: 'client', name: 'Cliente' } as any;
    component.orderItems = [{ productId: 'product', name: 'Agua', quantity: 1, price: 10, basePrice: 10 }];
  });

  it('sends the entered description on creation', () => {
    component.description = '  Llamar al llegar  ';
    component.saveOrder();
    expect(state.createOrder).toHaveBeenCalledWith(jasmine.objectContaining({ description: 'Llamar al llegar' }));
  });

  it('allows clearing a description when editing', () => {
    component.loadOrderData('order', false);
    component.isEditing = true;
    component.editingOrderId = 'order';
    component.description = '';
    component.saveOrder();
    expect(state.updateOrder).toHaveBeenCalledWith(jasmine.objectContaining({ description: null }));
  });

  it('loads the existing description when editing or reopening', () => {
    component.loadOrderData('order', false);
    expect(component.description).toBe('Llamar al llegar');
    component.description = '';
    component.loadOrderData('order', true);
    expect(component.description).toBe('Llamar al llegar');
  });

  it('rejects descriptions over the limit', () => {
    component.description = 'x'.repeat(1001);
    component.saveOrder();
    expect(state.createOrder).not.toHaveBeenCalled();
    expect(component.feedbackTone).toBe('warning');
  });
});
