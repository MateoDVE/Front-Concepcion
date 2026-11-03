import { compareRouteOrders } from './route-order';
import { Order } from './types';

describe('Route sequence shared by admin and vendor', () => {
  const order = (id: string, status: Order['status'], routeOrder: number | null, createdAt = '2026-10-28T12:00:00Z') =>
    ({ id, status, routeOrder, createdAt } as Order);
  it('preserves manual order across pending, loaded and in-route states', () => {
    const orders = [order('a', 'route', 3), order('b', 'pending', 1), order('c', 'loaded', 2)];
    expect(orders.sort(compareRouteOrders).map(o => o.id)).toEqual(['b', 'c', 'a']);
  });
  it('appends new orders and keeps finished stops below active stops', () => {
    const orders = [order('done', 'delivered', 1), order('new', 'pending', null), order('failed', 'failed', 2), order('active', 'loaded', 3)];
    expect(orders.sort(compareRouteOrders).map(o => o.id)).toEqual(['active', 'new', 'done', 'failed']);
  });
  it('uses creation date and ID as deterministic fallback', () => {
    const orders = [order('b', 'loaded', null), order('a', 'pending', null), order('old', 'route', null, '2026-10-28T10:00:00Z')];
    expect(orders.sort(compareRouteOrders).map(o => o.id)).toEqual(['old', 'a', 'b']);
  });
});
