import { Injectable, signal, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of, combineLatest, throwError, defer } from 'rxjs';
import { map, switchMap, catchError, tap, finalize } from 'rxjs/operators';
import { Client, Product, Vendor, Order, OrderStatus, KPIs } from '../models/types';
import { APP_CONFIG } from '../config/constants';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly loadingCount = signal(0);
  readonly loadErrors = signal<string[]>([]);
  private trackLoad<T>(name: string, request: Observable<T>): Observable<T> {
    return defer(() => {
      this.loadingCount.update(n => n + 1);
      return request.pipe(
        tap(() => this.loadErrors.update(names => names.filter(item => item !== name))),
        catchError(error => {
          this.loadErrors.update(names => [...new Set([...names, name])]);
          return throwError(() => error);
        }),
        finalize(() => this.loadingCount.update(n => n - 1))
      );
    });
  }

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
      return orders.filter(o => this.getOrderDate(o) === todayStr);
    })
  );

  // Computed KPIs Observable
  kpis$: Observable<KPIs> = combineLatest([this.orders$, this.isTodayClosed$]).pipe(
    map(([orders, isClosed]) => {
      if (isClosed) {
        return { pending: 0, inRoute: 0, delivered: 0, totalRevenue: 0 };
      }

      const todayStr = this.getLocalDateString();
      const todayOrders = orders.filter(o => this.getOrderDate(o) === todayStr);

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

    // Load data initially and re-load if auth state changes
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.initData();
      } else {
        this.specialPricesCache.clear();
        this.loadErrors.set([]);
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
    
    this.loadVendors();

    const loadInitialOrders = () => {
      if (this.authService.userRole === 'vendedor') {
        this.loadTodayOrders();
      } else {
        this.loadOrders();
      }
    };

    this.checkTodayClosedStatus().subscribe({
      next: () => {
        loadInitialOrders();
      },
      error: (err) => {
        console.error('Error checking today closed status', err);
        loadInitialOrders();
      }
    });
  }

  public loadVendors(): void {
    this.trackLoad('vendedores', this.http.get<any[]>(`${APP_CONFIG.apiUrl}/users/vendors`)).subscribe({
      next: dbVendors => {
        const vendors = dbVendors.map(v => this.mapVendor(v));
        this.vendorsSubject.next(vendors);
        const matchingVendor = vendors.find(v => v.usuario_id === this.authService.userId);
        this.activeVendorSubject.next(matchingVendor ?? vendors[0] ?? null);
      },
      error: err => console.error('Error loading vendors', err)
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
    this.trackLoad('clientes', this.http.get<any[]>(`${APP_CONFIG.apiUrl}/clients`)).subscribe({
      next: (res) => this.clientsSubject.next(res.map(c => this.mapClient(c))),
      error: (err) => console.error('Error loading clients', err)
    });
  }

  public loadProducts(): void {
    this.trackLoad('inventario', this.http.get<any[]>(`${APP_CONFIG.apiUrl}/products`)).subscribe({
      next: (res) => this.productsSubject.next(res.map(p => this.mapProduct(p))),
      error: (err) => console.error('Error loading products', err)
    });
  }

  reorderRoute(vendorId: string, date: string, orderIds: string[], previousOrderIds: string[]): Observable<void> {
    return this.http.patch(`${APP_CONFIG.apiUrl}/orders/route-order`, {
      vendedor_id: vendorId, fecha: date, order_ids: orderIds, previous_order_ids: previousOrderIds
    }).pipe(
      map(() => {
        const positions = new Map(orderIds.map((id, index) => [id, index + 1]));
        this.ordersSubject.next(this.ordersSubject.value.map(order => {
          const position = positions.get(order.id);
          return position === undefined ? order : { ...order, routeOrder: position };
        }));
      })
    );
  }

  fetchOrders(): Observable<Order[]> {
    return this.http.get<any[]>(`${APP_CONFIG.apiUrl}/orders`).pipe(
      map(rows => rows.map(row => this.mapOrder(row)))
    );
  }

  public loadTodayOrders(): void {
    const todayStr = this.getLocalDateString();
    const vendorId = this.authService.userRole === 'vendedor' ? this.activeVendorSubject.value?.id : undefined;
    const params = new URLSearchParams({ fecha_programada: todayStr });
    if (vendorId) {
      params.set('vendedor_id', vendorId);
    }
    this.trackLoad('ruta', this.http.get<any[]>(`${APP_CONFIG.apiUrl}/orders?${params.toString()}`)).subscribe({
      next: (res) => {
        const mappedToday = res.map(o => this.mapOrder(o));
        const otherOrders = this.ordersSubject.value.filter(
          o => this.getOrderDate(o) !== todayStr
            || (vendorId ? o.vendorId !== vendorId : false)
        );
        this.ordersSubject.next([...mappedToday, ...otherOrders]);
      },
      error: (err) => console.error('Error loading today orders', err)
    });
  }

  private upsertOrderInState(dbOrder: any): void {
    if (!dbOrder || !dbOrder.id) {
      this.loadTodayOrders();
      return;
    }
    const mapped = this.mapOrder(dbOrder);
    const current = this.ordersSubject.value;
    const exists = current.some(o => o.id === mapped.id);
    this.ordersSubject.next(
      exists ? current.map(o => (o.id === mapped.id ? mapped : o)) : [mapped, ...current]
    );
  }

  public loadOrders(): void {
    this.trackLoad('pedidos', this.http.get<any[]>(`${APP_CONFIG.apiUrl}/orders`)).subscribe({
      next: (res) => this.ordersSubject.next(res.map(o => this.mapOrder(o))),
      error: (err) => console.error('Error loading orders', err)
    });
  }

  // ---- Entity Mappers (Database <-> Frontend Models) ----
  private mapClient(db: any): Client {
    return {
      id: db.id,
      name: db.nombre,
      phone: db.telefono || '',
      address: db.direccion || '',
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
      active: db.activo !== false,
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
      routeOrder: db.orden_ruta ?? null,
      clientAddress: db.cliente?.direccion,
      vendorName: db.vendedor?.nombre || null,
      status: db.estado as OrderStatus,
      scheduledDate: db.fecha_programada?.slice(0, 10),
      createdAt: db.fecha_creacion || db.created_at,
      deliveredAt: db.fecha_entrega || null,
      description: db.descripcion ?? null,
      paymentMethod: (db.metodo_pago as any) || null,
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
  ): Observable<Client> {
    const body = {
      nombre: name,
      telefono: phone,
      direccion: address,
      ubicacion_url: locationUrl || null,
      tipo_cliente: clientType,
      precios_especiales: specialPrices
    };
    return this.http.post<any>(`${APP_CONFIG.apiUrl}/clients`, body).pipe(
      map(row => this.mapClient(row)),
      tap(client => this.clientsSubject.next([client, ...this.clientsSubject.value]))
    );
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

  addProduct(name: string, basePrice: number, stock: number, unit: string): Observable<unknown> {
    const body = {
      nombre: name,
      precio_base: basePrice,
      stock: stock,
      unidad: unit
    };
    return this.http.post<unknown>(`${APP_CONFIG.apiUrl}/products`, body).pipe(tap(() => this.loadProducts()));
  }

  updateProductStock(productId: string, amount: number): Observable<unknown> {
    const body = {
      cantidad: amount
    };
    return this.http.patch<unknown>(`${APP_CONFIG.apiUrl}/products/${productId}/stock`, body).pipe(tap(() => this.loadProducts()));
  }

  updateProductBasePrice(productId: string, newPrice: number): Observable<unknown> {
    const body = {
      precio_base: newPrice
    };
    return this.http.put<unknown>(`${APP_CONFIG.apiUrl}/products/${productId}`, body).pipe(tap(() => this.loadProducts()));
  }

  createOrder(orderData: any): Observable<Order> {
    const body: any = {
      descripcion: orderData.description,
      fecha_programada: orderData.scheduledDate,
      cliente_id: orderData.clientId,
      vendedor_id: orderData.vendorId || undefined,
      estado: orderData.status || undefined,
      metodo_pago: orderData.paymentMethod || undefined,
      detalles: orderData.items.map((item: any) => ({
        producto_id: item.productId,
        cantidad: item.quantity,
        precio_aplicado: item.price
      }))
    };
    return this.http.post<any>(`${APP_CONFIG.apiUrl}/orders`, body).pipe(
      tap(created => {
        this.upsertOrderInState(created);
        if (body.estado === 'delivered') this.loadProducts();
      }),
      map(created => this.mapOrder(created))
    );
  }

  updateOrderStatus(orderId: string, status: OrderStatus,
    extra?: { failedReason?: string; paymentMethod?: 'efectivo' | 'qr' }): Observable<Order> {
    const previousStatus = this.ordersSubject.value.find(o => o.id === orderId)?.status;
    return this.http.patch<any>(`${APP_CONFIG.apiUrl}/orders/${orderId}/status`, {
      estado: status,
      motivo_falla: extra?.failedReason,
      metodo_pago: status === 'delivered' ? (extra?.paymentMethod || 'efectivo') : null
    }).pipe(
      catchError(error => this.http.get<any>(`${APP_CONFIG.apiUrl}/orders/${orderId}`).pipe(
        tap(current => this.upsertOrderInState(current)),
        switchMap(current => {
          const matches = current.estado === status
            && (status !== 'delivered' || current.metodo_pago === (extra?.paymentMethod || 'efectivo'))
            && (status !== 'failed' || current.motivo_falla === extra?.failedReason);
          return matches ? of(current) : throwError(() => error);
        }),
        catchError(() => throwError(() => error))
      )),
      tap(updated => {
        this.upsertOrderInState(updated);
        if (status === 'delivered' || previousStatus === 'delivered') this.loadProducts();
      }),
      map(updated => this.mapOrder(updated))
    );
  }

  updateOrder(updatedOrder: Order): Observable<Order> {
    const body: any = {
      descripcion: updatedOrder.description,
      fecha_programada: updatedOrder.scheduledDate,
      cliente_id: updatedOrder.clientId,
      vendedor_id: updatedOrder.vendorId || null,
      estado: updatedOrder.status,
      metodo_pago: updatedOrder.paymentMethod || null,
      detalles: updatedOrder.items.map(item => ({
        producto_id: item.productId,
        cantidad: item.quantity,
        precio_aplicado: item.price
      }))
    };
    return this.http.put<any>(`${APP_CONFIG.apiUrl}/orders/${updatedOrder.id}`, body).pipe(
      tap(updated => this.upsertOrderInState(updated)),
      map(updated => this.mapOrder(updated))
    );
  }

  deleteOrder(orderId: string): Observable<void> {
    const targetOrder = this.ordersSubject.value.find(o => o.id === orderId);
    return this.http.delete<void>(`${APP_CONFIG.apiUrl}/orders/${orderId}`).pipe(tap(() => {
      this.ordersSubject.next(this.ordersSubject.value.filter(o => o.id !== orderId));
      if (targetOrder?.status === 'delivered') this.loadProducts();
    }));
  }

  fetchOrder(id: string): Observable<Order> {
    return this.http.get<any>(`${APP_CONFIG.apiUrl}/orders/${id}`).pipe(map(row => this.mapOrder(row)));
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
    const todayStr = this.getLocalDateString();

    const closures: Observable<any>[] = [];

    vendors.forEach(vendor => {
      const vendorOrders = orders.filter(
        o => o.vendorId === vendor.id && this.getOrderDate(o) === todayStr
      );
      if (vendorOrders.length > 0) {
        const total_pedidos = vendorOrders.length;
        const entregados = vendorOrders.filter(o => o.status === 'delivered').length;
        const fallidos = vendorOrders.filter(o => o.status === 'failed').length;
        const total_sistema = Number(
          vendorOrders
            .filter(o => o.status === 'delivered')
            .reduce((sum, o) => sum + o.total, 0)
            .toFixed(2)
        );
        const total_recaudado = total_sistema;
        const diferencia = 0.0;

        const body = {
          fecha: todayStr,
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

  getOrderDate(order: Order): string {
    return order.scheduledDate || this.getLocalDateString(new Date(order.createdAt));
  }

  private readonly localDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit'
    });

  getLocalDateString(date: Date = new Date()): string {
    return this.localDateFormatter.format(date);
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
