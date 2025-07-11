'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";


export default function LoginPage() {
  const [email, setEmail] = useState('test@dev.js');
  const [password, setPassword] = useState('654321');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        if (rememberMe) {
          localStorage.setItem('rememberUser', 'true');
        } else {
          localStorage.removeItem('rememberUser');
        }
        const fromPath = searchParams.get('from');
        if (fromPath && fromPath.startsWith('/')) {
          router.push(fromPath);
        } else {
          router.push('/dashboard');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-white/90 rounded-2xl my-card-shadow p-12 space-y-6">
          <div className="text-center">
            <h1 className="text-xl 2xl:text-2xl font-bold text-charcoalcocoa">Orvia</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-charcoalcocoa">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="test@dev.js"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="focus-visible:ring-offset-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-charcoalcocoa">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="transition-colors duration-100"
              />
              <Label htmlFor="rememberMe" className="cursor-pointer select-none text-sm text-ashmocha">
                Remember Me
              </Label>
            </div>
            <Button type="submit" className="w-full bg-deeproseblush text-white hover:bg-deeproseblush/90 hover:shadow-sm" loading={isLoading}>
              Login
            </Button>
            {error && <p className="text-sm text-errorred text-center">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
} 