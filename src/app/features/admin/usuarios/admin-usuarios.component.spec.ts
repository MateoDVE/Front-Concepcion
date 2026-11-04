import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AdminUsuariosComponent } from './admin-usuarios.component';
import { StaffService, StaffUser } from '../../../core/services/staff.service';
import { StateService } from '../../../core/services/state.service';

describe('AdminUsuariosComponent', () => {
  const service = { list: jasmine.createSpy('list'), create: jasmine.createSpy('create'), setStatus: jasmine.createSpy('setStatus') };
  beforeEach(async () => {
    service.list.calls.reset(); service.create.calls.reset(); service.setStatus.calls.reset();
    service.list.and.returnValue(of([]));
    await TestBed.configureTestingModule({ imports: [AdminUsuariosComponent], providers: [{ provide: StaffService, useValue: service }, { provide: StateService, useValue: { loadVendors: jasmine.createSpy('loadVendors') } }] }).compileComponents();
  });
  async function setup() {
    const fixture = TestBed.createComponent(AdminUsuariosComponent);
    fixture.detectChanges(); await fixture.whenStable();
    return fixture;
  }
  it('requires confirmation, prevents duplicate requests and offers reactivation after soft delete', async () => {
    service.list.and.returnValue(of([{ id: 'staff', nombre: 'Nelson', usuario: 'vendedor1', rol: 'vendedor', activo: true }]));
    const fixture = await setup();
    const response = new Subject<{ id: string; activo: boolean }>();
    service.setStatus.and.returnValue(response);
    fixture.nativeElement.querySelector('[aria-label="Desactivar a Nelson"]').click();
    fixture.detectChanges();
    expect(service.setStatus).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Su historial y pedidos se conservarán');
    fixture.componentInstance.confirmStatusChange();
    fixture.componentInstance.confirmStatusChange();
    expect(service.setStatus).toHaveBeenCalledOnceWith('staff', false);
    response.next({ id: 'staff', activo: false }); response.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Activar a Nelson"]')).not.toBeNull();
    expect(fixture.componentInstance.users[0].activo).toBeFalse();
    expect(TestBed.inject(StateService).loadVendors).toHaveBeenCalled();
    service.setStatus.and.returnValue(of({ id: 'staff', activo: true }));
    fixture.componentInstance.requestStatusChange(fixture.componentInstance.users[0]);
    fixture.componentInstance.confirmStatusChange(); fixture.detectChanges();
    expect(service.setStatus).toHaveBeenCalledWith('staff', true);
    expect(fixture.nativeElement.querySelector('[aria-label="Desactivar a Nelson"]')).not.toBeNull();
  });
  it('keeps the current state visible when a status update fails', async () => {
    service.list.and.returnValue(of([{ id: 'staff', nombre: 'Almacén', usuario: 'almacen', rol: 'almacen', activo: true }]));
    service.setStatus.and.returnValue(throwError(() => new Error('offline')));
    const fixture = await setup();
    fixture.componentInstance.requestStatusChange(fixture.componentInstance.users[0]);
    fixture.componentInstance.confirmStatusChange(); fixture.detectChanges();
    expect(fixture.componentInstance.users[0].activo).toBeTrue();
    expect(fixture.componentInstance.updatingStatus).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No se pudo confirmar');
  });
  it('shows the empty state and validates required fields without calling the API', async () => {
    const fixture = await setup();
    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(service.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay usuarios');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Revisa');
  });
  it('prevents duplicate submissions and clears credentials after creating a warehouse user', async () => {
    const fixture = await setup();
    const response = new Subject<StaffUser>(); service.create.and.returnValue(response);
    fixture.componentInstance.model = { nombre: 'Ana Pérez', usuario: 'ana', email: 'ana@example.com', password: 'StrongPass123!', rol: 'almacen', telefono: '123' };
    fixture.detectChanges(); await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.create.calls.mostRecent().args[0].telefono).toBeUndefined();
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue();
    response.next({ id: 'new', nombre: 'Ana Pérez', usuario: 'ana', rol: 'almacen', activo: true }); response.complete();
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.model.password).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Ya puede iniciar sesión');
    expect(service.list).toHaveBeenCalledTimes(2);
  });
  it('preserves form values and displays duplicate-email errors', async () => {
    const fixture = await setup();
    service.create.and.returnValue(throwError(() => ({ error: { message: 'El correo electrónico ya está registrado.' } })));
    fixture.componentInstance.model = { nombre: 'Ana', usuario: 'ana', email: 'ana@example.com', password: 'StrongPass123!', rol: 'vendedor' };
    fixture.detectChanges(); await fixture.whenStable();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.model.nombre).toBe('Ana');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('ya está registrado');
    expect(fixture.componentInstance.saving).toBeFalse();
  });
});
