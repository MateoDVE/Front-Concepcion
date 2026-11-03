import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { AdminPedidosComponent } from './admin-pedidos.component';
import { StateService } from '../../../core/services/state.service';
import { Order } from '../../../core/models/types';

describe('Fast route reordering', () => {
  let component: AdminPedidosComponent;
  let requests: Subject<void>[];
  let state: any;
  beforeEach(() => {
    requests = [];
    const orders = ['a', 'b', 'c'].map((id, i) => ({
      id, vendorId: 'vendor', clientName: id, routeOrder: i + 1,
      status: 'pending', createdAt: '2026-11-02T12:00:00Z'
    } as Order));
    state = {
      orders$: new BehaviorSubject(orders), vendors$: of([]),
      getLocalDateString: () => '2026-11-02', loadOrders: jasmine.createSpy(),
      reorderRoute: jasmine.createSpy().and.callFake(() => {
        const request = new Subject<void>(); requests.push(request); return request;
      })
    };
    TestBed.configureTestingModule({ providers: [
      { provide: StateService, useValue: state }, { provide: Router, useValue: {} }
    ] });
    component = TestBed.runInInjectionContext(() => new AdminPedidosComponent());
    component.selectedRouteVendor = 'vendor';
    component.ngOnInit();
  });

  it('moves immediately without waiting for the server', () => {
    component.moveRouteOrder(0, 1);
    expect(component.routeOrders.map(o => o.id)).toEqual(['b', 'a', 'c']);
    expect(component.savingRoute).toBeTrue();
    expect(state.reorderRoute).toHaveBeenCalledOnceWith('vendor', '2026-11-02', ['b', 'a', 'c'], ['a', 'b', 'c']);
  });

  it('coalesces rapid moves and saves sequentially against the last confirmed order', () => {
    component.moveRouteOrder(0, 1);
    component.moveRouteOrder(1, 1);
    component.moveRouteOrder(0, 1);
    expect(component.routeOrders.map(o => o.id)).toEqual(['c', 'b', 'a']);
    expect(requests.length).toBe(1);
    requests[0].next(); requests[0].complete();
    expect(requests.length).toBe(2);
    expect(state.reorderRoute.calls.mostRecent().args).toEqual(['vendor', '2026-11-02', ['c', 'b', 'a'], ['b', 'a', 'c']]);
    requests[1].next(); requests[1].complete();
    expect(component.savingRoute).toBeFalse();
    expect(state.loadOrders).not.toHaveBeenCalled();
  });

  it('does not overwrite pending clicks when shared state refreshes', () => {
    component.moveRouteOrder(0, 1);
    component.moveRouteOrder(1, 1);
    state.orders$.next([...state.orders$.value]);
    expect(component.routeOrders.map(o => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('discards the queued sequence and refreshes on conflict', () => {
    component.moveRouteOrder(0, 1);
    component.moveRouteOrder(1, 1);
    requests[0].error({ status: 409 });
    expect(requests.length).toBe(1);
    expect(component.savingRoute).toBeFalse();
    expect(component.routeOrders.map(o => o.id)).toEqual(['a', 'b', 'c']);
    expect(state.loadOrders).toHaveBeenCalledTimes(1);
    expect(component.routeMessage).toContain('La ruta cambió');
  });
});
