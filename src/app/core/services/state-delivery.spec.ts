import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { StateService } from './state.service';
import { AuthService } from './auth.service';
import { APP_CONFIG } from '../config/constants';

describe('Delivery response recovery', () => {
  let state: StateService;
  let http: HttpTestingController;
  const url = `${APP_CONFIG.apiUrl}/orders/order-1`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { currentUser$: of(null) } }] });
    state = TestBed.inject(StateService);
    http = TestBed.inject(HttpTestingController);
    spyOn(state, 'loadProducts');
  });
  afterEach(() => http.verify());
  it('recovers a saved delivery after losing the PATCH response', () => {
    const success = jasmine.createSpy('success');
    state.updateOrderStatus('order-1', 'delivered', { paymentMethod: 'efectivo' }).subscribe(success);
    http.expectOne(`${url}/status`).error(new ProgressEvent('error'));
    http.expectOne(url).flush({ id: 'order-1', estado: 'delivered', metodo_pago: 'efectivo', detalles: [], total: 18 });
    expect(success).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'delivered' }));
    expect(state.loadProducts).toHaveBeenCalled();
  });
  it('does not report success if the delivery was not saved', () => {
    const error = jasmine.createSpy('error');
    state.updateOrderStatus('order-1', 'delivered').subscribe({ error });
    http.expectOne(`${url}/status`).flush({ message: 'Inventario no disponible' }, { status: 400, statusText: 'Bad Request' });
    http.expectOne(url).flush({ id: 'order-1', estado: 'loaded', detalles: [], total: 18 });
    expect(error).toHaveBeenCalledWith(jasmine.objectContaining({ status: 400 }));
  });
  it('does not accept a different payment method as confirmation', () => {
    const error = jasmine.createSpy('error');
    state.updateOrderStatus('order-1', 'delivered', { paymentMethod: 'qr' }).subscribe({ error });
    http.expectOne(`${url}/status`).error(new ProgressEvent('error'));
    http.expectOne(url).flush({ id: 'order-1', estado: 'delivered', metodo_pago: 'efectivo', detalles: [], total: 18 });
    expect(error).toHaveBeenCalled();
  });
});
