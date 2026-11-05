import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
      id, vendorId: 'vendor', clientName: id, routeOrder: i + 1, total: 18, items: [], clientId: id, vendorName: 'Vendedor', deliveredAt: null,
      status: 'pending', createdAt: '2026-11-02T12:00:00Z'
    } as Order));
    state = {
      orders$: new BehaviorSubject(orders), vendors$: of([]),
      getLocalDateString: () => '2026-11-02', getOrderDate: () => '2026-11-02', loadOrders: jasmine.createSpy(),
      reorderRoute: jasmine.createSpy().and.callFake(() => {
        const request = new Subject<void>(); requests.push(request); return request;
      })
    };
    TestBed.configureTestingModule({ providers: [
      { provide: StateService, useValue: state }, provideRouter([])
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
  it('inserts a dragged stop at a distant position and saves once', () => {
    component.startRouteDrag();
    component.dropRouteOrder({ previousIndex: 0, currentIndex: 2, isPointerOverContainer: true } as any);
    expect(component.routeOrders.map(o => o.id)).toEqual(['b', 'c', 'a']);
    expect(state.reorderRoute).toHaveBeenCalledOnceWith('vendor', '2026-11-02', ['b', 'c', 'a'], ['a', 'b', 'c']);
    expect(component.draggingRoute).toBeFalse();
  });

  it('does not save when released outside the list or at the same position', () => {
    component.dropRouteOrder({ previousIndex: 0, currentIndex: 2, isPointerOverContainer: false } as any);
    component.dropRouteOrder({ previousIndex: 1, currentIndex: 1, isPointerOverContainer: true } as any);
    expect(state.reorderRoute).not.toHaveBeenCalled();
    expect(component.routeOrders.map(o => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the drag snapshot stable during background updates', () => {
    component.startRouteDrag();
    state.orders$.next([...state.orders$.value].reverse());
    component.moveRouteOrder(0, 1);
    expect(component.routeOrders.map(o => o.id)).toEqual(['a', 'b', 'c']);
    expect(state.reorderRoute).not.toHaveBeenCalled();
    component.endRouteDrag();
  });
  it('allows another drag while saving and queues the latest sequence', () => {
    component.dropRouteOrder({ previousIndex: 0, currentIndex: 2, isPointerOverContainer: true } as any);
    component.startRouteDrag();
    requests[0].next(); requests[0].complete();
    expect(requests.length).toBe(1);
    component.dropRouteOrder({ previousIndex: 0, currentIndex: 2, isPointerOverContainer: true } as any);
    expect(component.routeOrders.map(o => o.id)).toEqual(['c', 'a', 'b']);
    expect(state.reorderRoute.calls.mostRecent().args).toEqual(['vendor', '2026-11-02', ['c', 'a', 'b'], ['b', 'c', 'a']]);
  });
  it('defers conflict recovery until the user releases the dragged stop', () => {
    component.moveRouteOrder(0, 1);
    component.startRouteDrag();
    requests[0].error({ status: 409 });
    expect(state.loadOrders).not.toHaveBeenCalled();
    component.dropRouteOrder({ previousIndex: 0, currentIndex: 2, isPointerOverContainer: true } as any);
    expect(component.routeOrders.map(o => o.id)).toEqual(['a', 'b', 'c']);
    expect(requests.length).toBe(1);
    expect(state.loadOrders).toHaveBeenCalledTimes(1);
  });
  it('starts dragging on immediate mouse movement in the rendered route', async () => {
    const fixture = TestBed.createComponent(AdminPedidosComponent);
    fixture.componentInstance.selectedRouteVendor = 'vendor';
    fixture.detectChanges();
    await fixture.whenStable();
    const grip = fixture.nativeElement.querySelector('.route-grip') as HTMLElement;
    grip.scrollIntoView({ block: 'center' });
    const rect = grip.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    grip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1, detail: 1, clientX: x, clientY: y }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, buttons: 1, clientX: x, clientY: y + 12 }));
    expect(fixture.componentInstance.draggingRoute).toBeTrue();
    const preview = document.querySelector('.cdk-drag-preview') as HTMLElement;
    expect(getComputedStyle(preview).transitionDuration).toBe('0s');
    preview.classList.add('cdk-drag-animating');
    expect(getComputedStyle(preview).transitionDuration).toBe('0s');
    preview.classList.remove('cdk-drag-animating');
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y + 12 }));
    await new Promise(resolve => setTimeout(resolve, 400));
    fixture.destroy();
  });
  it('moves immediately without scheduling positional animation for keyboard clicks', () => {
    const reposition = spyOn<any>(component, 'repositionRouteOrder').and.callThrough();
    component.moveRouteOrder(0, 1, new MouseEvent('click', { detail: 0 }));
    expect(reposition).toHaveBeenCalledWith(0, 1, false);
    expect(component.routeOrders.map(o => o.id)).toEqual(['b', 'a', 'c']);
  });

  it('starts a touch drag immediately without a hold and keeps the preview attached to the gesture', async () => {
    const fixture = TestBed.createComponent(AdminPedidosComponent);
    fixture.componentInstance.selectedRouteVendor = 'vendor';
    fixture.detectChanges();
    await fixture.whenStable();
    const grip = fixture.nativeElement.querySelector('.route-grip') as HTMLElement;
    grip.scrollIntoView({ block: 'center' });
    const rect = grip.getBoundingClientRect();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    const touch = (y: number) => new Touch({ identifier: 1, target: grip,
      clientX: rect.left + 20, clientY: y, pageX: rect.left + 20 + window.scrollX, pageY: y + window.scrollY });
    const start = touch(rect.top + 20);
    grip.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
    const moved = touch(rect.top + 35);
    grip.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [moved], targetTouches: [moved], changedTouches: [moved] }));
    expect(fixture.componentInstance.draggingRoute).toBeTrue();
    grip.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [moved] }));
    await new Promise(resolve => setTimeout(resolve, 400));
    fixture.destroy();
  });
  it('does not scan historical orders again when beginning a drag or rendering counters', async () => {
    const fixture = TestBed.createComponent(AdminPedidosComponent);
    fixture.componentInstance.selectedRouteVendor = 'vendor';
    fixture.detectChanges();
    await fixture.whenStable();
    const dateLookup = spyOn(state, 'getOrderDate').and.callThrough();
    fixture.componentInstance.startRouteDrag();
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.componentInstance.unfulfilledCount).toBe(3);
    expect(fixture.componentInstance.totalDayAmount).toBe(54);
    expect(dateLookup).not.toHaveBeenCalled();
    fixture.destroy();
  });
  it('updates the cached pending count when order status changes', () => {
    expect(component.unfulfilledCount).toBe(3);
    state.orders$.next(state.orders$.value.map((o: Order) => ({ ...o, status: 'delivered' })));
    expect(component.unfulfilledCount).toBe(0);
  });
});
