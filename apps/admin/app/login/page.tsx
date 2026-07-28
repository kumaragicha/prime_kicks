'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginSchema } from '@prime-kicks/validation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prime-kicks/ui';
import { useAuth } from '@/lib/auth';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      router.replace('/');
    } catch (err) {
      setFormError(err instanceof Error ? cleanError(err.message) : 'Login failed');
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Prime Admin</CardTitle>
          <p className="text-sm text-neutral-500">Sign in to manage products and users.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">Email</span>
              <input className={fieldClass} type="email" autoComplete="email" {...register('email')} />
              {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">Password</span>
              <input
                className={fieldClass}
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <span className="text-xs text-red-600">{errors.password.message}</span>
              )}
            </label>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Turn a raw `API 401: {...}` message into something friendlier. */
function cleanError(message: string): string {
  if (message.includes('401')) return 'Invalid email or password.';
  if (message.toLowerCase().includes('not permitted')) return message;
  return 'Login failed. Please try again.';
}
