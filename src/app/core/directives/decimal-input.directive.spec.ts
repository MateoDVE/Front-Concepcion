import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DecimalInputDirective } from './decimal-input.directive';

@Component({
  template: `
    <input type="text" appDecimalInput [(ngModel)]="price" [min]="minVal" #priceInput="ngModel" />
  `,
  imports: [FormsModule, DecimalInputDirective],
  standalone: true
})
class TestHostComponent {
  price: number | null = 10.5;
  minVal = 1;
}

describe('DecimalInputDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let inputEl: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    inputEl = fixture.nativeElement.querySelector('input');
  });

  it('should initialize input element with initial numeric value', () => {
    expect(inputEl.value).toBe('10.5');
  });

  it('should replace comma with period on input', () => {
    inputEl.value = '15,75';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(inputEl.value).toBe('15.75');
    expect(component.price).toBe(15.75);
  });

  it('should restrict multiple dots', () => {
    inputEl.value = '15.5.9';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(inputEl.value).toBe('15.59');
    expect(component.price).toBe(15.59);
  });

  it('should filter non-numeric characters', () => {
    inputEl.value = 'Bs. 25,50';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(inputEl.value).toBe('25.50');
    expect(component.price).toBe(25.5);
  });

  it('should clean up leading or trailing dots on blur', () => {
    inputEl.value = '12.';
    inputEl.dispatchEvent(new Event('input'));
    inputEl.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(inputEl.value).toBe('12');
    expect(component.price).toBe(12);

    inputEl.value = '.5';
    inputEl.dispatchEvent(new Event('input'));
    inputEl.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(inputEl.value).toBe('0.5');
    expect(component.price).toBe(0.5);
  });
});
