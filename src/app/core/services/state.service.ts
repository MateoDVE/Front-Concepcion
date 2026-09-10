import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of, combineLatest } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Client, Product, Vendor, Order, OrderStatus, KPIs } from '../models/types';
import { APP_CONFIG } from '../config/constants';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Behavior Subjects
  private clientsSubject = new BehaviorSubject<Client[]>([]);
  private productsSubject = new BehaviorSubject<Product[]>([]);
  private vendorsSubject = new BehaviorSubject<Vendor[]>([]);
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  private activeVendorSubject = new BehaviorSubject<Vendor | null>(null);
  private specialPricesCache = new Map<string, any[]>();

  // Expose as Observables
  clients$ = this.clientsSubject.asObservable();
  products$ = this.productsSubject.asObservable();
  vendors$ = this.vendorsSubject.asObservable();
  orders$ = this.ordersSubject.asObservable();
  activeVendor$ = this.activeVendorSubject.asObservable();

  private isTodayClosedSubject = new BehaviorSubject<boolean>(false);
  isTodayClosed$ = this.isTodayClosedSubject.asObservable();

  get isTodayClosed(): boolean {
    return this.isTodayClosedSubject.value;
  }

  todayOrders$: Observable<Order[]> = combineLatest([this.orders$, this.isTodayClosed$]).pipe(
    map(([orders, isClosed]) => {
      if (isClosed) {
        return [];
      }
      const todayStr = this.getLocalDateString();
      return orders.filter(o => this.getLocalDateString(new Date(o.createdAt)) === todayStr);
    })
  );

  // Computed KPIs Observable
  kpis$: Observable<KPIs> = combineLatest([this.orders$, this.isTodayClosed$]).pipe(
    map(([orders, isClosed]) => {
      if (isClosed) {
        return { pending: 0, inRoute: 0, delivered: 0, totalRevenue: 0 };
      }

      const todayStr = this.getLocalDateString();
      const todayOrders = orders.filter(o => this.getLocalDateString(new Date(o.createdAt)) === todayStr);

      const pending = todayOrders.filter(o => o.status === 'pending').length;
      const inRoute = todayOrders.filter(o => o.status === 'route' || o.status === 'loaded').length;
      const delivered = todayOrders.filter(o => o.status === 'delivered').length;
      const totalRevenue = todayOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + o.total, 0);

      return { pending, inRoute, delivered, totalRevenue };
    })
  );

  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.initData();

    // Re-load data if auth state changes
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.initData();
      } else {
        // Clear state on logout
        this.clientsSubject.next([]);
        this.productsSubject.next([]);
        this.vendorsSubject.next([]);
        this.ordersSubject.next([]);
        this.activeVendorSubject.next(null);
      }
    });
  }

  // ---- Fetch Data from API ----
  public initData(): void {
    if (!this.isBrowser) return;
    if (!this.authService.isLoggedIn) return;

    this.loadClients();
    this.loadProducts();
    
    // Load vendors and match the active logged-in vendor
    this.http.get<any[]>(`${APP_CONFIG.apiUrl}/users/vendors`).subscribe({
      next: (dbVendors) => {
        const mappedVendors = dbVendors.map(v => this.mapVendor(v));
        this.vendorsSubject.next(mappedVendors);

        // Match the logged-in user to their vendor profile
        const matchingVendor = mappedVendors.find(v => v.usuario_id === this.authService.userId);
        if (matchingVendor) {
          this.activeVendorSubject.next(matchingVendor);
        } else if (mappedVendors.length > 0) {
          this.activeVendorSubject.next(mappedVendors[0]);
        }
      },
      error: (err) => console.error('Error loading vendors', err)
    });

    this.checkTodayClosedStatus().subscribe({
      next: () => {
        this.loadOrders();
      },
      error: (err) => {
        console.error('Error checking today closed status', err);
        this.loadOrders();
      }
    });
  }

  public checkTodayClosedStatus(): Observable<boolean> {
    const todayStr = this.getLocalDateString();
    return this.http.get<any[]>(`${APP_CONFIG.apiUrl}/closings/report/history`).pipe(
      map(data => {
        const closed = data.some(r => r.fecha.split('T')[0] === todayStr && r.tipo_registro === 'CERRADO');
        this.isTodayClosedSubject.next(closed);
        return closed;
      })
    );
  }

  public loadClients(): void {
    this.http.get<any[]>(`${APP_CONFIG.apiUrl}/clients`).subscribe({
      next: (res) => this.clientsSubject.next(res.map(c => this.mapClient(c))),
      error: (err) => console.error('Error loading clients', err)
    });
  }

  public loadProducts(): void {
    this.http.get<any[]>(`${APP_CONFIG.apiUrl}/products`).subscribe({
      next: (res) => this.productsSubject.next(res.map(p => this.mapProduct(p))),
      error: (err) => console.error('Error loading products', err)
    });
  }

  public loadOrders(): void {
    this.http.get<any[]>(`${APP_CONFIG.apiUrl}/orders`).subscribe({
      next: (res) => this.ordersSubject.next(res.map(o => this.mapOrder(o))),
      error: (err) => console.error('Error loading orders', err)
    });
  }

  // ---- Entity Mappers (Database <-> Frontend Models) ----
  private mapClient(db: any): Client {
    return {
      id: db.id,
      name: db.nombre,
      phone: db.telefono,
      address: db.direccion,
      locationUrl: db.ubicacion_url || `https://maps.google.com/?q=${encodeURIComponent(db.direccion)}`,
      clientType: db.tipo_cliente || 'Particular',
      createdBy: db.creado_por_nombre || 'Sistema',
      updatedBy: db.actualizado_por_nombre || undefined,
      createdAt: db.created_at,
      updatedAt: db.updated_at
    };
  }

  private mapProduct(db: any): Product {
    return {
      id: db.id,
      name: db.nombre,
      basePrice: Number(db.precio_base),
      stock: db.stock,
      unit: db.unidad
    };
  }

  private mapVendor(db: any): Vendor {
    return {
      id: db.id,
      name: db.nombre,
      phone: db.telefono || '',
      avatar: db.avatar,
      usuario_id: db.usuario_id || undefined
    };
  }

  private mapOrder(db: any): Order {
    return {
      id: db.id,
      code: db.codigo || db.id,
      clientId: db.cliente_id,
      clientName: db.cliente?.nombre || 'Cliente Desconocido',
      clientPhone: db.cliente?.telefono || this.clientsSubject.value.find(c => c.id === db.cliente_id)?.phone || undefined,
      clientLocationUrl: db.cliente?.ubicacion_url || (db.cliente?.direccion ? `https://maps.google.com/?q=${encodeURIComponent(db.cliente.direccion)}` : undefined),
      vendorId: db.vendedor_id,
      vendorName: db.vendedor?.nombre || null,
      status: db.estado as OrderStatus,
      createdAt: db.fecha_creacion || db.created_at,
      deliveredAt: db.fecha_entrega || null,
      total: Number(db.total),
      failedReason: db.motivo_falla || undefined,
      items: (db.detalles || []).map((d: any) => ({
        productId: d.producto_id,
        name: d.producto?.nombre || 'Producto Desconocido',
        quantity: d.cantidad,
        price: Number(d.precio_aplicado)
      }))
    };
  }

  public getClientById(id: string): Client | undefined {
    return this.clientsSubject.value.find(c => c.id === id);
  }



  // ---- Mutators (HTTP Actions) ----

  addClient(
    name: string,
    phone: string,
    address: string,
    locationUrl: string,
    clientType: string = 'Particular',
    specialPrices: { producto_id: string; precio_especial: number }[] = []
  ): void {
    const body = {
      nombre: name,
      telefono: phone,
      direccion: address,
      ubicacion_url: locationUrl || null,
      tipo_cliente: clientType,
      precios_especiales: specialPrices
    };
    this.http.post<any>(`${APP_CONFIG.apiUrl}/clients`, body).subscribe({
      next: (newClient) => {
        this.loadClients();
        if (newClient && newClient.id && specialPrices.length > 0) {
          this.loadSpecialPricesForClient(newClient.id).subscribe();
        }
      },
      error: (err) => console.error('Error creating client', err)
    });
  }

  updateClient(
    id: string,
    data: {
      name?: string;
      phone?: string;
      address?: string;
      locationUrl?: string;
      clientType?: string;
    }
  ): Observable<Client> {
    const body: any = {};
    if (data.name !== undefined) body.nombre = data.name;
    if (data.phone !== undefined) body.telefono = data.phone;
    if (data.address !== undefined) body.direccion = data.address;
    if (data.locationUrl !== undefined) body.ubicacion_url = data.locationUrl;
    if (data.clientType !== undefined) body.tipo_cliente = data.clientType;

    return this.http.put<any>(`${APP_CONFIG.apiUrl}/clients/${id}`, body).pipe(
      map(updated => {
        this.loadClients();
        return this.mapClient(updated);
      })
    );
  }

  addProduct(name: string, basePrice: number, stock: number, unit: string): void {
    const body = {
      nombre: name,
      precio_base: basePrice,
      stock: stock,
      unidad: unit
    };
    this.http.post<any>(`${APP_CONFIG.apiUrl}/products`, body).subscribe({
      next: () => this.loadProducts(),
      error: (err) => console.error('Error creating product', err)
    });
  }

  updateProductStock(productId: string, amount: number): void {
    const body = {
      cantidad: amount
    };
    this.http.patch<any>(`${APP_CONFIG.apiUrl}/products/${productId}/stock`, body).subscribe({
      next: () => this.loadProducts(),
      error: (err) => console.error('Error updating stock', err)
    });
  }

  updateProductBasePrice(productId: string, newPrice: number): void {
    const body = {
      precio_base: newPrice
    };
    this.http.put<any>(`${APP_CONFIG.apiUrl}/products/${productId}`, body).subscribe({
      next: () => this.loadProducts(),
      error: (err) => console.error('Error updating base price', err)
    });
  }

  createOrder(orderData: any): void {
    const body = {
      cliente_id: orderData.clientId,
      vendedor_id: orderData.vendorId || undefined,
      estado: orderData.status || undefined,
      detalles: orderData.items.map((item: any) => ({
        producto_id: item.productId,
        cantidad: item.quantity,
        precio_aplicado: item.price
      }))
    };
    this.http.post<any>(`${APP_CONFIG.apiUrl}/orders`, body).subscribe({
      next: () => {
        this.loadOrders();
        this.loadProducts();
      },
      error: (err) => console.error('Error creating order', err)
    });
  }

  updateOrderStatus(orderId: string, status: OrderStatus, extra?: { failedReason?: string }): void {
    // Actualización optimista local para respuesta visual instantánea
    const currentOrders = this.ordersSubject.value;
    const orderIndex = currentOrders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      const updatedList = [...currentOrders];
      const target = updatedList[orderIndex];
      updatedList[orderIndex] = {
        ...target,
        status,
        failedReason: extra?.failedReason !== undefined ? extra.failedReason : (status === 'delivered' ? undefined : target.failedReason),
        deliveredAt: status === 'delivered' ? (target.deliveredAt || new Date().toISOString()) : (status === 'route' || status === 'loaded' ? null : target.deliveredAt)
      };
      this.ordersSubject.next(updatedList);
    }

    const body = {
      estado: status,
      motivo_falla: extra?.failedReason || undefined
    };
    this.http.patch<any>(`${APP_CONFIG.apiUrl}/orders/${orderId}/status`, body).subscribe({
      next: () => {
        this.loadOrders();
        this.loadProducts();
      },
      error: (err) => {
        console.error('Error updating order status', err);
        this.loadOrders();
      }
    });
  }

  updateOrder(updatedOrder: Order): void {
    const body = {
      cliente_id: updatedOrder.clientId,
      vendedor_id: updatedOrder.vendorId || null,
      estado: updatedOrder.status,
      detalles: updatedOrder.items.map(item => ({
        producto_id: item.productId,
        cantidad: item.quantity,
        precio_aplicado: item.price
      }))
    };
    this.http.put<any>(`${APP_CONFIG.apiUrl}/orders/${updatedOrder.id}`, body).subscribe({
      next: () => {
        this.loadOrders();
        this.loadProducts();
      },
      error: (err) => console.error('Error updating order', err)
    });
  }

  deleteOrder(orderId: string): void {
    this.http.delete<any>(`${APP_CONFIG.apiUrl}/orders/${orderId}`).subscribe({
      next: () => {
        this.loadOrders();
        this.loadProducts();
      },
      error: (err) => console.error('Error deleting order', err)
    });
  }

  // ---- Closing Day and Reschedule operability ----
  moveUnfulfilledOrdersToNextDay(fecha?: string): Observable<any> {
    const body = fecha ? { fecha } : {};
    return this.http.post<any>(`${APP_CONFIG.apiUrl}/orders/move-to-next-day`, body).pipe(
      tap(() => {
        this.loadOrders();
        this.loadProducts();
      })
    );
  }

  resetData(): Observable<any> {
    // Perform daily closures on the backend for each vendor that has orders today
    const orders = this.ordersSubject.value;
    const vendors = this.vendorsSubject.value;

    const closures: Observable<any>[] = [];

    vendors.forEach(vendor => {
      const vendorOrders = orders.filter(o => o.vendorId === vendor.id);
      if (vendorOrders.length > 0) {
        const total_pedidos = vendorOrders.length;
        const entregados = vendorOrders.filter(o => o.status === 'delivered').length;
        const fallidos = vendorOrders.filter(o => o.status === 'failed').length;
        const total_sistema = vendorOrders.reduce((sum, o) => sum + o.total, 0);
        const total_recaudado = vendorOrders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);
        const diferencia = total_recaudado - total_sistema;

        const body = {
          fecha: this.getLocalDateString(),
          vendedor_id: vendor.id,
          total_pedidos,
          entregados,
          fallidos,
          total_sistema,
          total_recaudado,
          diferencia,
          observaciones: 'Cierre de jornada automático desde frontend'
        };

        closures.push(this.http.post<any>(`${APP_CONFIG.apiUrl}/closings`, body));
      }
    });

    const closureAction$ = closures.length > 0 ? forkJoin(closures) : of([]);

    return closureAction$.pipe(
      switchMap(res => {
        return this.moveUnfulfilledOrdersToNextDay(this.getLocalDateString()).pipe(
          map(() => res),
          catchError(err => {
            console.error('Error trasladando pedidos pendientes al día siguiente:', err);
            return of(res);
          })
        );
      }),
      map(res => {
        this.isTodayClosedSubject.next(true);
        this.loadOrders();
        this.loadProducts();
        return res;
      })
    );
  }

  getLocalDateString(date: Date = new Date()): string {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  }

  // ---- Price rule helper ----
  getSpecialPriceFromCache(clientId: string, productId: string): number | null {
    const prices = this.specialPricesCache.get(clientId);
    if (!prices) return null;
    const match = prices.find(p => p.producto_id === productId);
    return match ? Number(match.precio_especial) : null;
  }

  getLastPriceApplied(clientId: string, productId: string): number {
    // Rule 1: Special price from cache (precios_clientes)
    const specialPrice = this.getSpecialPriceFromCache(clientId, productId);
    if (specialPrice !== null) {
      return specialPrice;
    }

    // Rule 2: Search locally in ordersSubject for this client's most recent delivered order with this product
    const clientOrders = this.ordersSubject.value
      .filter(o => o.clientId === clientId && o.status === 'delivered')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const order of clientOrders) {
      const item = order.items.find(i => i.productId === productId);
      if (item) {
        return item.price;
      }
    }

    // Rule 3: Fallback to the base price of the product from the catalog
    const product = this.productsSubject.value.find(p => p.id === productId);
    return product ? product.basePrice : 0;
  }

  loadSpecialPricesForClient(clientId: string): Observable<any[]> {
    return this.http.get<any[]>(`${APP_CONFIG.apiUrl}/clients/${clientId}/special-prices`).pipe(
      map(prices => {
        this.specialPricesCache.set(clientId, prices);
        return prices;
      })
    );
  }

  setClientSpecialPrice(clientId: string, productId: string, price: number): Observable<any> {
    const body = {
      producto_id: productId,
      precio_especial: price
    };
    return this.http.post<any>(`${APP_CONFIG.apiUrl}/clients/${clientId}/special-prices`, body).pipe(
      map(res => {
        // Reload special prices to keep cache in sync
        this.loadSpecialPricesForClient(clientId).subscribe();
        return res;
      })
    );
  }

  deleteClientSpecialPrice(clientId: string, productId: string): Observable<any> {
    return this.http.delete<any>(`${APP_CONFIG.apiUrl}/clients/${clientId}/special-prices/${productId}`).pipe(
      map(res => {
        // Reload special prices to keep cache in sync
        this.loadSpecialPricesForClient(clientId).subscribe();
        return res;
      })
    );
  }

  clearLocalData(): void {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  }

  getDailyReport(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${APP_CONFIG.apiUrl}/closings/report/daily?fecha=${date}`);
  }

  getHistoryReport(): Observable<any[]> {
    return this.http.get<any[]>(`${APP_CONFIG.apiUrl}/closings/report/history`);
  }

  getProductionReport(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${APP_CONFIG.apiUrl}/products/reports/production?fecha=${date}`);
  }
}
