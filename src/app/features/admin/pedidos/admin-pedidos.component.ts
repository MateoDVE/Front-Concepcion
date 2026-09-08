import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { StateService } from '../../../core/services/state.service';
import { Order, OrderStatus } from '../../../core/models/types';
import { FormsModule } from '@angular/forms';
import { FeedbackModalComponent } from '../../../core/components/feedback-modal/feedback-modal.component';

type FilterStatus = 'all' | OrderStatus;

@Component({
  selector: 'app-admin-pedidos',
  imports: [CommonModule, RouterLink, FormsModule, FeedbackModalComponent],
  templateUrl: './admin-pedidos.component.html',
  styleUrl: './admin-pedidos.component.scss',
  standalone: true
})
export class AdminPedidosComponent implements OnInit {
  private stateService = inject(StateService);
  private router = inject(Router);

  orders: Order[] = [];
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
    this.stateService.orders$.subscribe(o => {
      this.orders = o;
      this.applyFilterAndSearch();
    });
  }

  onSearchChange() {
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
      result = result.filter(o => this.stateService.getLocalDateString(new Date(o.createdAt)) === this.selectedDate);
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

    this.stateService.deleteOrder(this.pendingDeleteOrderId);
    this.cancelDeleteOrder();
    this.closeModal();
  }

  get unfulfilledOrdersToday(): Order[] {
    const targetDate = this.selectedDate || this.stateService.getLocalDateString();
    return this.orders.filter(o => {
      const orderDate = this.stateService.getLocalDateString(new Date(o.createdAt));
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
