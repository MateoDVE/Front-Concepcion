import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Order, OrderStatus, PaymentMethod } from '../models/types';

export interface DailyClosureExport {
  fecha: string;
  total_pedidos: number;
  total_entregados?: number;
  entregados?: number;
  total_fallidos?: number;
  fallidos?: number;
  total_ventas_sistema?: number | string;
  total_sistema_entregado?: number | string;
  total_ventas_recaudado?: number | string;
  total_recaudado?: number | string;
  total_diferencias?: number | string;
  diferencia?: number | string;
  porcentaje_efectividad?: number | string;
  efficiencyRate?: number | string;
  tipo_registro?: string;
}

export interface MonthlySummaryExport {
  monthKey: string;     // e.g. "2026-09"
  monthName: string;    // e.g. "Septiembre 2026"
  daysCount: number;
  totalOrders: number;
  totalDelivered: number;
  totalFailed: number;
  totalSistema: number | string;
  totalRecaudado: number | string;
  totalDiferencia: number | string;
  efficiencyRate: number;
  dailyClosures: DailyClosureExport[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {
  /**
   * Convierte de forma segura cualquier valor (string de base de datos o número) a float con 2 decimales
   */
  private toNumber(val: any): number {
    const num = Number(val);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
  }

  /**
   * Formatea fecha a YYYY-MM-DD en hora local de manera consistente
   */
  public formatDate(dateVal: any): string {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return String(dateVal).split('T')[0];
    }
  }

  /**
   * Formatea hora a HH:mm en hora local
   */
  public formatTime(dateVal: any): string {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private formatStatus(status: OrderStatus): string {
    switch (status) {
      case 'delivered':
        return 'Entregado';
      case 'failed':
        return 'Fallido';
      case 'route':
        return 'En Ruta';
      case 'loaded':
        return 'Cargado';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  }

  private formatPaymentMethod(method?: PaymentMethod | null): string {
    if (method === 'qr') return 'QR';
    if (method === 'efectivo') return 'Efectivo';
    return '-';
  }

  /**
   * Exporta el reporte de un mes:
   * - Hoja 1: Resumen Ejecutivo y Tabla Día por Día con Totales del Mes
   * - Hoja 2: Detalle Diario de Pedidos (todos los pedidos de cada día con cliente, vendedor, método de pago, monto, productos y motivo de falla)
   * - Hoja 3: Resumen de Productos Vendidos en el Mes
   */
  exportMonth(summary: MonthlySummaryExport, monthOrders: Order[] = []): void {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen y Tabla Diaria del Mes
    const wsSummary = this.createMonthSummaryWorksheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Mensual');

    // Hoja 2: Detalle de Pedidos Diario de cada día del mes (como si exportáramos el reporte de cada día)
    const wsOrders = this.createMonthOrdersWorksheet(summary.monthName, monthOrders);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Detalle de Pedidos');

    // Hoja 3: Resumen de Productos Vendidos
    const wsProducts = this.createMonthProductsWorksheet(summary.monthName, monthOrders);
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos Vendidos');

    const safeFileName = `Reporte_Mensual_${summary.monthKey}_${summary.monthName.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, safeFileName);
  }

  /**
   * Exporta todos los meses consolidados:
   * - Hoja 1: Resumen General Comparativo de Meses
   * - Hojas siguientes: Resumen de cada mes individual
   * - Hoja adicional: Detalle de todos los pedidos históricos registrados
   */
  exportAllMonths(summaries: MonthlySummaryExport[], allOrders: Order[] = []): void {
    const wb = XLSX.utils.book_new();

    // 1. Hoja de Resumen Anual / General
    const summaryData: any[][] = [
      ['DISTRIBUIDORA CONCEPCIÓN - CONSOLIDADO MENSUAL HISTÓRICO'],
      [`Generado: ${new Date().toLocaleDateString('es-BO')} ${new Date().toLocaleTimeString('es-BO')}`],
      [],
      [
        'Mes',
        'Días Operativos',
        'Pedidos Asignados',
        'Entregados',
        'Fallidos',
        'Ventas Sistema (Bs.)',
        'Total Recaudado (Bs.)',
        'Diferencia de Caja (Bs.)',
        'Efectividad (%)'
      ]
    ];

    let grandOrders = 0;
    let grandDelivered = 0;
    let grandFailed = 0;
    let grandSistema = 0;
    let grandRecaudado = 0;
    let grandDiferencia = 0;

    summaries.forEach((s) => {
      const orders = Number(s.totalOrders || 0);
      const delivered = Number(s.totalDelivered || 0);
      const failed = Number(s.totalFailed || 0);
      const sistema = this.toNumber(s.totalSistema);
      const recaudado = this.toNumber(s.totalRecaudado);
      const diferencia = this.toNumber(s.totalDiferencia);

      grandOrders += orders;
      grandDelivered += delivered;
      grandFailed += failed;
      grandSistema += sistema;
      grandRecaudado += recaudado;
      grandDiferencia += diferencia;

      summaryData.push([
        s.monthName,
        s.daysCount,
        orders,
        delivered,
        failed,
        sistema,
        recaudado,
        diferencia,
        `${s.efficiencyRate}%`
      ]);
    });

    const grandEfficiency = grandOrders > 0 ? Math.round((grandDelivered / grandOrders) * 100) : 0;

    summaryData.push([
      'TOTAL GENERAL',
      summaries.reduce((sum, s) => sum + s.daysCount, 0),
      grandOrders,
      grandDelivered,
      grandFailed,
      this.toNumber(grandSistema),
      this.toNumber(grandRecaudado),
      this.toNumber(grandDiferencia),
      `${grandEfficiency}%`
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [
      { wch: 22 }, // Mes
      { wch: 16 }, // Días Operativos
      { wch: 18 }, // Pedidos Asignados
      { wch: 14 }, // Entregados
      { wch: 12 }, // Fallidos
      { wch: 20 }, // Ventas Sistema
      { wch: 20 }, // Total Recaudado
      { wch: 22 }, // Diferencia
      { wch: 16 }  // Efectividad
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Anual');

    // 2. Hojas individuales por cada mes
    summaries.forEach((s) => {
      const wsMonth = this.createMonthSummaryWorksheet(s);
      const sheetName = s.monthName.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsMonth, sheetName);
    });

    // 3. Hoja con todos los pedidos si están disponibles
    if (allOrders && allOrders.length > 0) {
      const wsAllOrders = this.createMonthOrdersWorksheet('Histórico General', allOrders);
      XLSX.utils.book_append_sheet(wb, wsAllOrders, 'Detalle de Pedidos');
    }

    const safeFileName = `Reporte_Mensual_Consolidado_General.xlsx`;
    XLSX.writeFile(wb, safeFileName);
  }

  /**
   * Exporta la jornada de un solo día (Auditoría Diaria)
   */
  exportDailyReport(
    dateStr: string,
    orders: Order[],
    vendorBreakdown: any[] = [],
    productSummaries: any[] = []
  ): void {
    const wb = XLSX.utils.book_new();

    // 1. Hoja Desglose de Vendedores y Resumen Diario
    const dataResumen: any[][] = [
      ['DISTRIBUIDORA CONCEPCIÓN - AUDITORÍA DE JORNADA DIARIA'],
      [`Fecha Operativa: ${dateStr}`],
      [`Generado: ${new Date().toLocaleDateString('es-BO')} ${new Date().toLocaleTimeString('es-BO')}`],
      [],
      [
        'Vendedor',
        'Pedidos Asignados',
        'Entregados',
        'Fallidos',
        'En Ruta / Pendientes',
        'Cobrado Efectivo (Bs.)',
        'Cobrado QR (Bs.)',
        'Ventas Sistema (Bs.)',
        'Total Recaudado (Bs.)',
        'Diferencia (Bs.)',
        'Observaciones'
      ]
    ];

    vendorBreakdown.forEach((item) => {
      dataResumen.push([
        item.vendedor_nombre,
        Number(item.total_pedidos || 0),
        Number(item.entregados || 0),
        Number(item.fallidos || 0),
        Number((item.en_ruta || 0) + (item.pendientes || 0)),
        this.toNumber(item.total_efectivo),
        this.toNumber(item.total_qr),
        this.toNumber(item.total_sistema_entregado),
        this.toNumber(item.total_recaudado),
        this.toNumber(item.diferencia),
        item.observaciones || 'Declarado al cierre'
      ]);
    });

    const wsDay = XLSX.utils.aoa_to_sheet(dataResumen);
    wsDay['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 26 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDay, 'Auditoría Vendedores');

    // 2. Hoja Pedidos del Día
    if (orders && orders.length > 0) {
      const wsOrders = this.createMonthOrdersWorksheet(`Día ${dateStr}`, orders);
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos del Día');
    }

    // 3. Hoja Productos Vendidos
    if (productSummaries && productSummaries.length > 0) {
      const prodData: any[][] = [
        ['DISTRIBUIDORA CONCEPCIÓN - PRODUCTOS VENDIDOS EN LA JORNADA'],
        [`Fecha: ${dateStr}`],
        [],
        ['Producto', 'Unidades Vendidas', 'Ingreso Producido (Bs.)']
      ];
      productSummaries.forEach((p) => {
        prodData.push([
          p.name,
          `${p.quantitySold} ${p.unit}s`,
          this.toNumber(p.totalRevenue)
        ]);
      });
      const wsProd = XLSX.utils.aoa_to_sheet(prodData);
      wsProd['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, wsProd, 'Productos');
    }

    XLSX.writeFile(wb, `Reporte_Diario_${dateStr}.xlsx`);
  }

  /**
   * Crea la Hoja 1: Resumen Ejecutivo y Tabla Día por Día con Totales del Mes
   */
  private createMonthSummaryWorksheet(summary: MonthlySummaryExport): XLSX.WorkSheet {
    const data: any[][] = [
      ['DISTRIBUIDORA CONCEPCIÓN - REPORTE MENSUAL DE OPERACIONES'],
      [`Mes Operativo: ${summary.monthName}`],
      [`Fecha y Hora de Generación: ${new Date().toLocaleDateString('es-BO')} ${new Date().toLocaleTimeString('es-BO')}`],
      [],
      // Resumen Ejecutivo del Mes
      ['RESUMEN EJECUTIVO', ''],
      ['Días de Operación Registrados', summary.daysCount],
      ['Total Pedidos Asignados', Number(summary.totalOrders || 0)],
      ['Total Pedidos Entregados', Number(summary.totalDelivered || 0)],
      ['Total Pedidos Fallidos', Number(summary.totalFailed || 0)],
      ['Tasa de Efectividad Promedio (%)', `${summary.efficiencyRate}%`],
      ['Ventas Esperadas del Sistema (Bs.)', this.toNumber(summary.totalSistema)],
      ['Recaudación Declarada (Bs.)', this.toNumber(summary.totalRecaudado)],
      ['Diferencia Total de Caja (Bs.)', this.toNumber(summary.totalDiferencia)],
      [],
      // Encabezados de la Tabla Diaria
      [
        'Fecha',
        'Pedidos Asignados',
        'Entregados',
        'Fallidos',
        'Ventas Sistema (Bs.)',
        'Ventas Recaudado (Bs.)',
        'Diferencia (Bs.)',
        'Efectividad (%)',
        'Estado de Jornada'
      ]
    ];

    const sortedDaily = [...summary.dailyClosures].sort((a, b) => a.fecha.localeCompare(b.fecha));

    sortedDaily.forEach((rec) => {
      const fecha = (rec.fecha || '').split('T')[0];
      const pedidos = Number(rec.total_pedidos || 0);
      const entregados = Number(rec.total_entregados ?? rec.entregados ?? 0);
      const fallidos = Number(rec.total_fallidos ?? rec.fallidos ?? 0);
      const sistema = this.toNumber(rec.total_ventas_sistema ?? rec.total_sistema_entregado ?? 0);
      const recaudado = this.toNumber(rec.total_ventas_recaudado ?? rec.total_recaudado ?? 0);
      const diferencia = this.toNumber(rec.total_diferencias ?? rec.diferencia ?? 0);
      const efectividad = `${rec.porcentaje_efectividad ?? rec.efficiencyRate ?? 0}%`;
      const estado = rec.tipo_registro || 'CERRADO';

      data.push([
        fecha,
        pedidos,
        entregados,
        fallidos,
        sistema,
        recaudado,
        diferencia,
        efectividad,
        estado
      ]);
    });

    // Fila final de Totales
    data.push([
      'TOTAL ACUMULADO DEL MES',
      Number(summary.totalOrders || 0),
      Number(summary.totalDelivered || 0),
      Number(summary.totalFailed || 0),
      this.toNumber(summary.totalSistema),
      this.toNumber(summary.totalRecaudado),
      this.toNumber(summary.totalDiferencia),
      `${summary.efficiencyRate}%`,
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 }
    ];

    return ws;
  }

  /**
   * Crea la Hoja 2: Detalle Diario de Pedidos (todos los pedidos de cada día con cliente, vendedor, método de pago, monto, productos y motivo de falla)
   */
  private createMonthOrdersWorksheet(titleContext: string, orders: Order[]): XLSX.WorkSheet {
    const data: any[][] = [
      ['DISTRIBUIDORA CONCEPCIÓN - DETALLE DIARIO DE PEDIDOS'],
      [`Período: ${titleContext} | Cantidad de Pedidos: ${orders.length}`],
      [`Fecha y Hora de Generación: ${new Date().toLocaleDateString('es-BO')} ${new Date().toLocaleTimeString('es-BO')}`],
      [],
      [
        'Fecha',
        'Hora',
        'Código Pedido',
        'Cliente',
        'Teléfono',
        'Vendedor',
        'Estado',
        'Método Pago',
        'Monto Total (Bs.)',
        'Detalle de Productos',
        'Observación / Motivo Falla'
      ]
    ];

    if (orders.length === 0) {
      data.push([
        'Sin pedidos individuales registrados para este período.',
        '', '', '', '', '', '', '', '', '', ''
      ]);
    } else {
      // Ordenar pedidos por fecha y hora cronológicamente
      const sortedOrders = [...orders].sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

      let totalRecaudadoOrders = 0;

      sortedOrders.forEach((order) => {
        const fecha = this.formatDate(order.createdAt);
        const hora = this.formatTime(order.createdAt);

        const itemsStr = (order.items || [])
          .map((i) => `${i.quantity}x ${i.name} (Bs. ${i.price})`)
          .join('; ');

        const monto = this.toNumber(order.total);
        if (order.status === 'delivered') {
          totalRecaudadoOrders += monto;
        }

        data.push([
          fecha,
          hora,
          order.code || order.id,
          order.clientName,
          order.clientPhone || '-',
          order.vendorName || 'Sin Asignar',
          this.formatStatus(order.status),
          this.formatPaymentMethod(order.paymentMethod),
          monto,
          itemsStr,
          order.failedReason || ''
        ]);
      });

      // Fila final de Total
      data.push([
        'TOTAL RECAUDADO (ENTREGADOS)',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        this.toNumber(totalRecaudadoOrders),
        '',
        ''
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 14 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 16 }, // Código
      { wch: 26 }, // Cliente
      { wch: 14 }, // Teléfono
      { wch: 20 }, // Vendedor
      { wch: 14 }, // Estado
      { wch: 14 }, // Método Pago
      { wch: 18 }, // Monto Total
      { wch: 45 }, // Detalle de Productos
      { wch: 30 }  // Observación / Falla
    ];

    return ws;
  }

  /**
   * Crea la Hoja 3: Resumen de Productos Vendidos en el período
   */
  private createMonthProductsWorksheet(titleContext: string, orders: Order[]): XLSX.WorkSheet {
    const data: any[][] = [
      ['DISTRIBUIDORA CONCEPCIÓN - RESUMEN DE PRODUCTOS VENDIDOS'],
      [`Período: ${titleContext}`],
      [`Fecha de Descarga: ${new Date().toLocaleDateString('es-BO')} ${new Date().toLocaleTimeString('es-BO')}`],
      [],
      ['Producto', 'Unidades Vendidas', 'Ingreso Generado (Bs.)']
    ];

    const salesMap = new Map<string, { name: string; quantity: number; revenue: number }>();

    orders
      .filter((o) => o.status === 'delivered')
      .forEach((order) => {
        (order.items || []).forEach((item) => {
          const current = salesMap.get(item.productId) || {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
          current.quantity += item.quantity;
          current.revenue += item.quantity * item.price;
          salesMap.set(item.productId, current);
        });
      });

    let totalQty = 0;
    let totalRev = 0;

    if (salesMap.size === 0) {
      data.push(['Sin ventas de productos registradas para este período.', 0, 0]);
    } else {
      salesMap.forEach((val) => {
        totalQty += val.quantity;
        totalRev += val.revenue;
        data.push([val.name, val.quantity, this.toNumber(val.revenue)]);
      });

      data.push(['TOTAL GENERAL PRODUCTOS', totalQty, this.toNumber(totalRev)]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 30 }, // Producto
      { wch: 18 }, // Unidades
      { wch: 22 }  // Ingreso
    ];

    return ws;
  }
}
