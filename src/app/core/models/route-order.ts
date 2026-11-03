import { Order } from './types';

export function isActiveStop(order: Order): boolean {
  return ['pending', 'loaded', 'route'].includes(order.status);
}

export function compareRouteOrders(a: Order, b: Order): number {
  const completed = Number(!isActiveStop(a)) - Number(!isActiveStop(b));
  if (completed) return completed;
  const positionA = a.routeOrder ?? Number.MAX_SAFE_INTEGER;
  const positionB = b.routeOrder ?? Number.MAX_SAFE_INTEGER;
  return positionA - positionB || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    || a.id.localeCompare(b.id);
}
