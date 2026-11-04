import { DialogFocusDirective } from '../../../core/directives/dialog-focus.directive';
import { Observable, finalize } from 'rxjs';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, NgZone, OnInit, QueryList, ViewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { compareRouteOrders, isActiveStop } from '../../../core/models/route-order';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { Order, OrderStatus } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

type FilterStatus = 'all' | OrderStatus;

@Component({
  selector: 'app-admin-pedidos',
  imports: [DialogFocusDirective, CommonModule, RouterLink, FormsModule, FeedbackModalComponent],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.scss',
  standalone: true
})
export class AdminPedidosComponent implements OnInit {
  readonly stateService = inject(StateService);
  saving = false;
  private save(request: Observable<unknown>, onSuccess: () => void) {
    if (this.saving) return;
    this.saving = true;
    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => { this.saving = false; onSuccess(); },
      error: () => this.openFeedbackModal('No se pudo guardar',
        'El servidor no confirmó la operación. Conservamos tus datos; revisa la conexión y los registros antes de reintentar.', 'error')
    });
  }
  private router = inject(Router);

  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private zone = inject(NgZone);
  private pendingPositions = new Map<HTMLElement, number>();
  private pendingAnimationRender?: ReturnType<typeof afterNextRender>;
  @ViewChildren('routeStop') private routeStopElements?: QueryList<ElementRef<HTMLElement>>;
  movedOrderId: string | null = null;
  routeMovementMessage = '';
  private highlightTimer?: ReturnType<typeof setTimeout>;
  private stopAnimations = new Map<HTMLElement, Animation>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.highlightTimer);
      this.pendingAnimationRender?.destroy();
      this.pendingPositions.clear();
      this.stopAnimations.forEach(animation => animation.cancel());
      this.stopAnimations.clear();
    });
  }

  vendors$ = this.stateService.vendors$;
  selectedRouteVendor = '';
  routeOrders: Order[] = [];
  savingRoute = false;
  routeMessage = '';
  private confirmedRouteIds: string[] = [];
  private routeSaveInFlight = false;
  orders: Order[] = [];
  visibleCount = 40;
  trackEntity(_index: number, entity: { id: string }): string { return entity.id; }
  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;
  showDeleteOrderModal = false;
  pendingDeleteOrderId: string | null = null;

  // Move unfulfilled orders state
  showMoveModal = false;
  isMovingOrders = false;

  // Feedback modal
  showFeedbackModal = false;
  feedbackTitle = '';
  feedbackMessage = '';
  feedbackTone: 'info' | 'success' | 'warning' | 'error' = 'info';

  // Search & Filter state
  searchQuery = '';
  activeFilter: FilterStatus = 'all';

  // Date selection: defaults to today (fecha actual), supports past and future dates
  selectedDate = '';

  ngOnInit() {
    this.selectedDate = this.stateService.getLocalDateString();
    this.stateService.orders$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(o => {
      this.orders = o;
      this.applyFilterAndSearch();
    });
  }

  updateRouteOrders() {
    if (this.savingRoute) return;
    this.routeOrders = this.orders.filter(o => o.vendorId === this.selectedRouteVendor
      && this.stateService.getOrderDate(o) === this.selectedDate
      && isActiveStop(o)).sort(compareRouteOrders);
    this.confirmedRouteIds = this.routeOrders.map(o => o.id);
  }

  moveRouteOrder(index: number, direction: number) {
    const target = index + direction;
    if (index < 0 || index >= this.routeOrders.length || target < 0 || target >= this.routeOrders.length) return;
    // Only the two swapped rows change layout; avoid measuring the entire route.
    for (const position of [index, target]) {
      const element = this.routeStopElements?.get(position)?.nativeElement;
      if (element && !this.pendingPositions.has(element)) {
        this.pendingPositions.set(element, element.getBoundingClientRect().top);
      }
    }
    const movedOrder = this.routeOrders[index];
    this.movedOrderId = movedOrder.id;
    this.routeMovementMessage = `${movedOrder.clientName}: parada ${index + 1} → ${target + 1}.`;
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.movedOrderId = null, 700);
    const reordered = [...this.routeOrders];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.routeOrders = reordered;
    if (this.pendingPositions.size && !this.pendingAnimationRender) {
      this.pendingAnimationRender = afterNextRender(() => {
        this.pendingAnimationRender = undefined;
        const positions = this.pendingPositions;
        this.pendingPositions = new Map();
        this.zone.runOutsideAngular(() => this.animateRouteMovement(positions));
      }, { injector: this.injector });
    }
    this.savingRoute = true;
    this.routeMessage = 'Guardando orden… Puedes seguir organizando las paradas.';
    this.saveRoute();
  }

  private animateRouteMovement(previousPositions: Map<HTMLElement, number>) {
    // FLIP: animate from the previous visual position to the newly rendered layout.
    // Capture all final positions before starting animations to avoid layout thrashing.
    previousPositions.forEach((_top, element) => {
      this.stopAnimations.get(element)?.cancel();
      this.stopAnimations.delete(element);
    });
    const reducedMotion = this.routeStopElements?.first?.nativeElement.ownerDocument.defaultView
      ?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    const movements = Array.from(previousPositions, ([element, top]) => ({
      element, offset: top - element.getBoundingClientRect().top
    }));
    movements.forEach(({ element, offset }) => {
      if (!element.isConnected || Math.abs(offset) < 1 || !element.animate) return;
      const animation = element.animate([
        { transform: `translateY(${offset}px)` },
        { transform: 'translateY(0)' }
      ], { duration: 150, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' });
      this.stopAnimations.set(element, animation);
      animation.onfinish = () => {
        if (this.stopAnimations.get(element) === animation) this.stopAnimations.delete(element);
      };
    });
  }

  private saveRoute() {
    // Keep only the latest desired sequence while one request is in flight.
    if (this.routeSaveInFlight) return;
    const ids = this.routeOrders.map(o => o.id);
    if (ids.every((id, index) => id === this.confirmedRouteIds[index])) {
      this.savingRoute = false;
      this.routeMessage = 'Orden guardado.';
      return;
    }
    this.routeSaveInFlight = true;
    this.stateService.reorderRoute(this.selectedRouteVendor, this.selectedDate, ids, this.confirmedRouteIds)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.confirmedRouteIds = ids;
          this.routeSaveInFlight = false;
          this.saveRoute();
        },
        error: err => {
          this.routeSaveInFlight = false;
          this.savingRoute = false;
          this.movedOrderId = null;
          this.routeMovementMessage = '';
          this.updateRouteOrders();
          this.routeMessage = err.status === 409
            ? 'La ruta cambió. Se descartaron los movimientos pendientes y se actualizará la lista.'
            : 'No se pudo confirmar el guardado. Se descartaron los movimientos pendientes y se actualizará la lista.';
          this.stateService.loadOrders();
        }
      });
  }

  trackRouteOrder(_index: number, order: Order): string {
    return order.id;
  }

  refreshRoute() {
    this.stateService.loadOrders();
  }

  onSearchChange() {
    this.visibleCount = 40;
    this.applyFilterAndSearch();
  }

  setFilter(filter: FilterStatus) {
    this.activeFilter = filter;
    this.applyFilterAndSearch();
  }

  onDateChange() {
    this.applyFilterAndSearch();
  }

  setToday() {
    this.selectedDate = this.stateService.getLocalDateString();
    this.applyFilterAndSearch();
  }

  get isTodaySelected(): boolean {
    return this.selectedDate === this.stateService.getLocalDateString();
  }

  get isTomorrowSelected(): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.selectedDate === this.stateService.getLocalDateString(tomorrow);
  }

  get formattedSelectedDate(): string {
    if (!this.selectedDate) return '';
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekday = dateObj.toLocaleDateString('es-BO', { weekday: 'long' });
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const month = dateObj.toLocaleDateString('es-BO', { month: 'long' });

    if (this.isTodaySelected) {
      return `Hoy • ${capitalizedWeekday}, ${d} de ${month}`;
    } else if (this.isTomorrowSelected) {
      return `Mañana • ${capitalizedWeekday}, ${d} de ${month}`;
    } else {
      return `${capitalizedWeekday}, ${d} de ${month} de ${y}`;
    }
  }

  get totalDayAmount(): number {
    return this.filteredOrders.reduce((sum, o) => sum + o.total, 0);
  }

  applyFilterAndSearch() {
    let result = [...this.orders];

    // 1. Filtrar por fecha seleccionada (por defecto hoy, permite pasadas y futuras)
    if (this.selectedDate) {
      result = result.filter(o => this.stateService.getOrderDate(o) === this.selectedDate);
    }

    // 2. Filtrar por estado activo
    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'route') {
        result = result.filter(o => o.status === 'route' || o.status === 'loaded');
      } else {
        result = result.filter(o => o.status === this.activeFilter);
      }
    }

    // 3. Búsqueda por cliente, código de pedido o vendedor
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(o => 
        o.clientName.toLowerCase().includes(q) || 
        (o.code && o.code.toLowerCase().includes(q)) ||
        o.id.toLowerCase().includes(q) ||
        (o.vendorName && o.vendorName.toLowerCase().includes(q))
      );
    }

    // 4. Ordenar por fecha desc
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.filteredOrders = result;
    this.updateRouteOrders();
  }

  getClientInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toFixed(2)}`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--:--';
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }

  formatFullDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '--/--/----';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--/--/----';
    const date = d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    return `${date}, ${time}`;
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      loaded: 'Cargado',
      route: 'En Ruta',
      delivered: 'Entregado',
      failed: 'No Entregado',
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: OrderStatus): string {
    return `badge--${status}`;
  }

  showOrderDetail(order: Order) {
    this.selectedOrder = order;
  }

  closeModal() {
    this.selectedOrder = null;
  }

  reopenOrder(orderId: string) {
    this.closeModal();
    this.router.navigate(['/admin/crear-pedido'], { queryParams: { orderId, reopen: 'true' } });
  }

  editOrder(orderId: string) {
    this.closeModal();
    this.router.navigate(['/admin/crear-pedido'], { queryParams: { orderId } });
  }

  deleteOrder(orderId: string) {
    this.pendingDeleteOrderId = orderId;
    this.showDeleteOrderModal = true;
  }

  cancelDeleteOrder() {
    this.showDeleteOrderModal = false;
    this.pendingDeleteOrderId = null;
  }

  confirmDeleteOrder() {
    if (!this.pendingDeleteOrderId) return;

    this.save(this.stateService.deleteOrder(this.pendingDeleteOrderId), () => {
      this.cancelDeleteOrder();
      this.closeModal();
    });
  }

  get unfulfilledOrdersToday(): Order[] {
    const targetDate = this.selectedDate || this.stateService.getLocalDateString();
    return this.orders.filter(o => {
      const orderDate = this.stateService.getOrderDate(o);
      return orderDate === targetDate && ['pending', 'loaded', 'failed', 'route'].includes(o.status);
    });
  }

  get unfulfilledCount(): number {
    return this.unfulfilledOrdersToday.length;
  }

  openMoveModal() {
    this.showMoveModal = true;
  }

  cancelMoveModal() {
    this.showMoveModal = false;
  }

  confirmMoveOrders() {
    if (this.unfulfilledCount === 0) {
      this.cancelMoveModal();
      return;
    }

    this.isMovingOrders = true;
    const targetDate = this.selectedDate || this.stateService.getLocalDateString();
    this.stateService.moveUnfulfilledOrdersToNextDay(targetDate).subscribe({
      next: (res) => {
        this.isMovingOrders = false;
        this.showMoveModal = false;
        const count = res?.movedCount ?? this.unfulfilledCount;
        const nextDate = res?.targetDate || 'mañana';
        this.openFeedbackModal(
          'Pedidos Reprogramados',
          `Se han trasladado ${count} pedido(s) al día siguiente (${nextDate}) con estado Pendiente.`,
          'success'
        );
      },
      error: (err) => {
        console.error('Error al mover pedidos al día siguiente', err);
        this.isMovingOrders = false;
        this.showMoveModal = false;
        this.openFeedbackModal(
          'Error',
          'No se pudieron trasladar los pedidos al día siguiente. Por favor verifica la consola.',
          'error'
        );
      }
    });
  }

  openFeedbackModal(title: string, message: string, tone: 'info' | 'success' | 'warning' | 'error' = 'info') {
    this.feedbackTitle = title;
    this.feedbackMessage = message;
    this.feedbackTone = tone;
    this.showFeedbackModal = true;
  }

  closeFeedbackModal() {
    this.showFeedbackModal = false;
  }
}
