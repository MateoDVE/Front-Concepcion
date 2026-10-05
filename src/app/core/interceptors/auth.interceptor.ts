import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { catchError, switchMap } from 'rxjs/operators';
import { from, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getCurrentToken();

  let clonedReq = req;
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Evitar bucle si la petición original era la autenticación inicial
        if (req.url.includes('/users/me')) {
          authService.signOut().subscribe(() => {
            router.navigate(['/']);
          });
          return throwError(() => error);
        }

        // Intentar refrescar la sesión automáticamente con Supabase antes de cerrar sesión
        return from(authService.refreshSession()).pipe(
          switchMap((newToken) => {
            if (newToken) {
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next(retryReq);
            }

            // Si el refresh token falló o caducó por completo, forzar cierre de sesión
            authService.signOut().subscribe(() => {
              router.navigate(['/']);
            });
            return throwError(() => error);
          }),
          catchError((refreshErr) => {
            authService.signOut().subscribe(() => {
              router.navigate(['/']);
            });
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
