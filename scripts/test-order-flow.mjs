// Node-only behavioral checks for request lifecycle. Browser rendering is tested separately.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts') && !url.includes('/node_modules/')) {
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true }
      }).outputText;
      return { format: 'module', source, shortCircuit: true };
    }
    return next(url, context);
  }
});
await import('@angular/compiler');
const { createEnvironmentInjector, runInInjectionContext, PLATFORM_ID } = await import('@angular/core');
const { Router, ActivatedRoute } = await import('@angular/router');
const { of, Subject } = await import('rxjs');
const { StateService } = await import('../src/app/core/services/state.service.ts');
const { AdminCrearPedidoComponent } = await import('../src/app/features/admin/crear-pedido/admin-crear-pedido.component.ts');
const { VendorRutaComponent } = await import('../src/app/features/vendor/ruta/vendor-ruta.component.ts');

function setup(Component = AdminCrearPedidoComponent) {
  const response = new Subject();
  const calls = [];
  const original = { id: 'order', clientId: 'client', clientName: 'Cliente', status: 'loaded',
    createdAt: '2026-11-01T20:00:00Z', scheduledDate: '2026-11-09', description: 'Original',
    items: [{ productId: 'water', name: 'Agua', quantity: 2, price: 10 }] };
  const state = { createOrder: data => { calls.push(data); return response; },
    updateOrder: data => { calls.push(data); return response; },
    updateOrderStatus: (...args) => { calls.push(args); return response; },
    fetchOrder: () => of(original), loadSpecialPricesForClient: () => of([]),
    getOrderDate: order => order.scheduledDate, getLocalDateString: () => '2026-11-03' };
  const injector = createEnvironmentInjector([
    { provide: PLATFORM_ID, useValue: 'server' },
    { provide: StateService, useValue: state }, { provide: Router, useValue: { navigate() {} } },
    { provide: ActivatedRoute, useValue: {} }
  ]);
  const component = runInInjectionContext(injector, () => new Component());
  component.selectedClient = { id: 'client', name: 'Cliente' };
  component.orderItems = [{ productId: 'water', name: 'Agua', quantity: 2, price: 10, basePrice: 10 }];
  component.deliveryDate = '2026-11-09';
  return { component, response, calls, injector, original };
}

test('save waits for HTTP confirmation, preserves schedule and prevents duplicate dispatch', () => {
  const { component: c, response, calls, injector } = setup();
  c.saveOrder(); c.saveOrder();
  assert.equal(calls.length, 1); assert.equal(c.saving, true); assert.equal(c.showFeedbackModal, false);
  assert.equal(calls[0].scheduledDate, '2026-11-09');
  response.next({}); response.complete();
  assert.equal(c.saving, false); assert.equal(c.feedbackTone, 'success'); injector.destroy();
});

test('failed save keeps entered fields and permits a later retry', () => {
  const { component: c, response, injector } = setup();
  c.description = 'Llamar antes'; c.saveOrder(); response.error({ status: 500 });
  assert.equal(c.saving, false); assert.equal(c.feedbackTone, 'error');
  assert.equal(c.description, 'Llamar antes'); assert.equal(c.orderItems.length, 1); injector.destroy();
});

test('editing preserves status and creation date while changing schedule', () => {
  const { component: c, calls, injector, original } = setup();
  c.loadOrderData('order', false); c.deliveryDate = '2026-11-10'; c.saveOrder();
  assert.equal(calls[0].status, 'loaded'); assert.equal(calls[0].createdAt, original.createdAt);
  assert.equal(calls[0].scheduledDate, '2026-11-10'); injector.destroy();
});

test('fractional quantities are rejected before sending', () => {
  const { component: c, calls, injector } = setup(); c.orderItems[0].quantity = 1.5; c.saveOrder();
  assert.equal(calls.length, 0); injector.destroy();
});

test('delivery modal stays open on failure and sends only one request', () => {
  const { component: c, calls, response, injector, original } = setup(VendorRutaComponent);
  c.openDeliverModal(original); c.confirmDelivery(); c.confirmDelivery();
  assert.equal(calls.length, 1); assert.equal(c.showDeliverModal, true);
  response.error({ status: 500 }); assert.equal(c.showDeliverModal, true);
  assert.ok(c.actionError); assert.equal(c.pendingOrders.size, 0); injector.destroy();
});
