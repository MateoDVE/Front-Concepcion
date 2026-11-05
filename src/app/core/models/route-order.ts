import { Order } from './types';

export function isActiveStop(order: Order): boolean {
  return ['pending', 'loaded', 'route'].includes(order.status);
}

export function compareRouteOrders(a: Order, b: Order): number {
  const completed = Number(!isActiveStop(a)) - Number(!isActiveStop(b));
  if (completed) return completed;
  const positionA = a.routeOrder ?? Number.MAX_SAFE_INTEGER;
  const positionB = b.routeOrder ?? Number.MAX_SAFE_INTEGER;
  const position = positionA - positionB;
  if (position) return position;
  // Without a manual position, preserve the original vendor route criteria.
  const priority = { route: 0, loaded: 1, pending: 2, failed: 3, delivered: 4 };
  const status = priority[a.status] - priority[b.status];
  if (status) return status;
  if (a.status === 'delivered') {
    return new Date(a.deliveredAt || a.createdAt).getTime()
      - new Date(b.deliveredAt || b.createdAt).getTime();
  }
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    || (a.code || a.id).localeCompare(b.code || b.id);
}
