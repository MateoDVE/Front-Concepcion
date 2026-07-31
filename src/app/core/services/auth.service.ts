import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { APP_CONFIG } from '../config/constants';

export interface AuthUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: 'admin' | 'vendedor';
  activo: boolean;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private supabase!: SupabaseClient;
  private isBrowser: boolean;

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private token: string | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
      this.loadPersistedSession();
    }
  }

  private loadPersistedSession() {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('concepcion_auth_user');
      const savedToken = localStorage.getItem('concepcion_auth_token');
      
      if (savedUser && savedToken) {
        this.token = savedToken;
        this.currentUserSubject.next(JSON.parse(savedUser));
      }
    }
  }

  public getCurrentToken(): string | null {
    return this.token;
  }

  public get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  public get userRole(): 'admin' | 'vendedor' | null {
    return this.currentUserSubject.value?.rol || null;
  }

  public get userId(): string | null {
    return this.currentUserSubject.value?.id || null;
  }

  public signIn(email: string, password: string): Observable<AuthUser> {
    // 1. Sign in to Supabase to obtain the access token
    const promise = this.supabase.auth.signInWithPassword({ email, password });
    
    return from(promise).pipe(
      switchMap(response => {
        if (response.error) {
          return throwError(() => new Error(response.error.message));
        }
        
        const session = response.data.session;
        if (!session) {
          return throwError(() => new Error('No se pudo establecer la sesión en Supabase'));
        }

        const tempToken = session.access_token;
        
        // 2. Fetch the user profile from our backend using this temporary token
        return this.http.get<AuthUser>(`${APP_CONFIG.apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${tempToken}` }
        }).pipe(
          map(dbUser => {
            // Save state
            this.token = tempToken;
            this.currentUserSubject.next(dbUser);
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('concepcion_auth_token', tempToken);
              localStorage.setItem('concepcion_auth_user', JSON.stringify(dbUser));
            }
            
            return dbUser;
          })
        );
      }),
      catchError(err => {
        console.error('Error de autenticación:', err);
        return throwError(() => new Error(err.message || 'Error de inicio de sesión'));
      })
    );
  }

  public signOut(): Observable<void> {
    this.token = null;
    this.currentUserSubject.next(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('concepcion_auth_token');
      localStorage.removeItem('concepcion_auth_user');
    }

    if (this.supabase) {
      this.supabase.auth.signOut().catch(err => {
        console.warn('Error calling Supabase signOut in background:', err);
      });
    }

    return from(Promise.resolve());
  }
}
