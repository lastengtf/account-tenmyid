'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Harap masukkan email dan kata sandi');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email, password);

      // Handle SSO OAuth redirect if parameters are provided
      if (clientId && redirectUri) {
        const authorizeUrl = `/api/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
        router.push(authorizeUrl);
      } else {
        router.push('/profile');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Gagal masuk. Periksa kembali email dan kata sandi Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      setEmail('admin@ten.my.id');
      setPassword('Admin@TenMyId2026!');
    } else {
      setEmail('user@ten.my.id');
      setPassword('User@TenMyId2026!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">TEN Single Sign-On</h1>
          <p className="mt-1 text-xs text-slate-500">
            {clientId ? (
              <span className="text-blue-600 font-medium">Otorisasi akun untuk aplikasi: {clientId}</span>
            ) : (
              'Satu akun untuk mengakses seluruh ekosistem aplikasi TEN-MY-ID'
            )}
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Masuk ke Akun</h2>
            <p className="text-xs text-slate-500 mt-0.5">Masukkan kredensial akun SSO terpusat Anda</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@ten.my.id"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Kata Sandi
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Lupa kata sandi?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Masuk SSO</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-2">
              <Sparkles className="h-3 w-3 text-blue-500" />
              <span>Login Cepat Demo:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillQuickDemo('admin')}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                Akun Admin
              </button>
              <button
                type="button"
                onClick={() => fillQuickDemo('user')}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                Akun Member
              </button>
            </div>
          </div>
        </div>

        {/* Register footer link */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Belum memiliki akun SSO?{' '}
          <Link href="/auth/register" className="font-semibold text-blue-600 hover:underline">
            Daftar Akun Baru
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Memuat...</div>}>
      <LoginForm />
    </Suspense>
  );
}
