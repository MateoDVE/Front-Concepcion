import {
  Directive,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  Renderer2
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator
} from '@angular/forms';

@Directive({
  selector: 'input[appDecimalInput]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DecimalInputDirective),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DecimalInputDirective),
      multi: true
    }
  ],
  host: {
    'type': 'text',
    'inputmode': 'decimal',
    'autocomplete': 'off'
  }
})
export class DecimalInputDirective implements ControlValueAccessor, Validator {
  @Input() min?: number | string;
  @Input() max?: number | string;

  private onChange: (val: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};
  private disabled = false;

  constructor(
    private el: ElementRef<HTMLInputElement>,
    private renderer: Renderer2
  ) {}

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;

    // Permitir teclas de control y navegación
    if (
      event.ctrlKey ||
      event.metaKey ||
      key === 'Backspace' ||
      key === 'Delete' ||
      key === 'Tab' ||
      key === 'Escape' ||
      key === 'Enter' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End'
    ) {
      return;
    }

    // Permitir dígitos 0-9
    if (/^[0-9]$/.test(key)) {
      return;
    }

    // Permitir separador decimal (. o ,) solo si no existe uno previo
    if (key === '.' || key === ',') {
      const current = this.el.nativeElement.value;
      if (!current.includes('.') && !current.includes(',')) {
        return;
      }
    }

    // Bloquear cualquier otro carácter
    event.preventDefault();
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = this.el.nativeElement;
    const raw = input.value;

    if (!raw.trim()) {
      input.value = '';
      this.onChange(null);
      return;
    }

    const normalized = this.normalizeDecimalString(raw);

    // Actualizar valor en el DOM si cambió tras la normalización
    if (normalized !== raw) {
      const cursor = input.selectionStart ?? normalized.length;
      input.value = normalized;
      input.setSelectionRange(cursor, cursor);
    }

    // Notificar a Angular NgModel
    if (normalized === '' || normalized === '.') {
      this.onChange(null);
    } else {
      const parsed = parseFloat(normalized);
      this.onChange(isNaN(parsed) ? null : parsed);
    }
  }

  private normalizeDecimalString(raw: string): string {
    const hasDot = raw.includes('.');
    const hasComma = raw.includes(',');

    if (hasDot && hasComma) {
      const lastDot = raw.lastIndexOf('.');
      const lastComma = raw.lastIndexOf(',');
      if (lastComma > lastDot) {
        // Formato con coma como decimal (ej. 'Bs. 25,50' o '1.250,50')
        const beforeDecimal = raw.slice(0, lastComma).replace(/[^0-9]/g, '');
        const afterDecimal = raw.slice(lastComma + 1).replace(/[^0-9]/g, '');
        return beforeDecimal + '.' + afterDecimal;
      } else {
        // Formato con punto como decimal (ej. '1,250.50')
        const beforeDecimal = raw.slice(0, lastDot).replace(/[^0-9]/g, '');
        const afterDecimal = raw.slice(lastDot + 1).replace(/[^0-9]/g, '');
        return beforeDecimal + '.' + afterDecimal;
      }
    }

    // Si solo hay comas, convertirlas en punto
    let sanitized = hasComma ? raw.replace(/,/g, '.') : raw;

    // Filtrar caracteres no numéricos excepto el punto
    sanitized = sanitized.replace(/[^0-9.]/g, '');

    // Si hay múltiples puntos, mantener únicamente el primero
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    return sanitized;
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();

    const input = this.el.nativeElement;
    let val = input.value.trim();

    // Limpieza al desenfocar
    if (val.startsWith('.')) {
      val = '0' + val;
      input.value = val;
    } else if (val.endsWith('.')) {
      val = val.slice(0, -1);
      input.value = val;
    }

    if (val === '' || val === '.') {
      input.value = '';
      this.onChange(null);
    } else {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        this.onChange(parsed);
      }
    }
  }

  // ---- ControlValueAccessor implementation ----

  writeValue(value: any): void {
    const input = this.el.nativeElement;

    if (value === null || value === undefined || value === '') {
      input.value = '';
      return;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      input.value = '';
      return;
    }

    // Si el usuario está interactuando activamente con el campo,
    // evitamos sobrescribir si el valor numérico equivale a lo que ya escribió (ej. '12.' o '12.0')
    if (document.activeElement === input) {
      const currentParsed = parseFloat(input.value.replace(/,/g, '.'));
      if (currentParsed === numValue) {
        return;
      }
    }

    input.value = numValue.toString();
  }

  registerOnChange(fn: (val: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.renderer.setProperty(this.el.nativeElement, 'disabled', isDisabled);
  }

  // ---- Validator implementation ----

  validate(control: AbstractControl): ValidationErrors | null {
    if (control.value === null || control.value === undefined || control.value === '') {
      return null;
    }

    const val = Number(control.value);
    if (isNaN(val)) {
      return { invalidNumber: true };
    }

    if (this.min !== undefined && this.min !== null && this.min !== '') {
      const minNum = Number(this.min);
      if (val < minNum) {
        return { min: { min: minNum, actual: val } };
      }
    }

    if (this.max !== undefined && this.max !== null && this.max !== '') {
      const maxNum = Number(this.max);
      if (val > maxNum) {
        return { max: { max: maxNum, actual: val } };
      }
    }

    return null;
  }

  registerOnValidatorChange?(fn: () => void): void {
    this.onValidatorChange = fn;
  }
}
