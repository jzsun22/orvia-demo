'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Eye, EyeOff } from "lucide-react";


export default function LoginPage() {
  const [email, setEmail] = useState('test@dev.js');
  const [password, setPassword] = useState('654321');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      <svg 
        className="absolute bottom-0 left-0 w-full h-full" 
        viewBox="0 0 900 600" 
        xmlns="http://www.w3.org/2000/svg" 
        preserveAspectRatio="xMidYMax slice"
      >
        <path d="M0 428L16.7 431C33.3 434 66.7 440 100 444.3C133.3 448.7 166.7 451.3 200 448.2C233.3 445 266.7 436 300 437.3C333.3 438.7 366.7 450.3 400 443C433.3 435.7 466.7 409.3 500 403.2C533.3 397 566.7 411 600 422.2C633.3 433.3 666.7 441.7 700 434C733.3 426.3 766.7 402.7 800 394.2C833.3 385.7 866.7 392.3 883.3 395.7L900 399L900 601L883.3 601C866.7 601 833.3 601 800 601C766.7 601 733.3 601 700 601C666.7 601 633.3 601 600 601C566.7 601 533.3 601 500 601C466.7 601 433.3 601 400 601C366.7 601 333.3 601 300 601C266.7 601 233.3 601 200 601C166.7 601 133.3 601 100 601C66.7 601 33.3 601 16.7 601L0 601Z" fill="#f9ecea"/>
        <path d="M0 452L16.7 449.2C33.3 446.3 66.7 440.7 100 444.3C133.3 448 166.7 461 200 468C233.3 475 266.7 476 300 480.5C333.3 485 366.7 493 400 486.7C433.3 480.3 466.7 459.7 500 456.3C533.3 453 566.7 467 600 478.5C633.3 490 666.7 499 700 498.7C733.3 498.3 766.7 488.7 800 480.2C833.3 471.7 866.7 464.3 883.3 460.7L900 457L900 601L883.3 601C866.7 601 833.3 601 800 601C766.7 601 733.3 601 700 601C666.7 601 633.3 601 600 601C566.7 601 533.3 601 500 601C466.7 601 433.3 601 400 601C366.7 601 333.3 601 300 601C266.7 601 233.3 601 200 601C166.7 601 133.3 601 100 601C66.7 601 33.3 601 16.7 601L0 601Z" fill="#f2deda"/>
        <path d="M0 516L16.7 516.3C33.3 516.7 66.7 517.3 100 523.3C133.3 529.3 166.7 540.7 200 540.2C233.3 539.7 266.7 527.3 300 518C333.3 508.7 366.7 502.3 400 503.3C433.3 504.3 466.7 512.7 500 520.3C533.3 528 566.7 535 600 531.3C633.3 527.7 666.7 513.3 700 508.3C733.3 503.3 766.7 507.7 800 514.7C833.3 521.7 866.7 531.3 883.3 536.2L900 541L900 601L883.3 601C866.7 601 833.3 601 800 601C766.7 601 733.3 601 700 601C666.7 601 633.3 601 600 601C566.7 601 533.3 601 500 601C466.7 601 433.3 601 400 601C366.7 601 333.3 601 300 601C266.7 601 233.3 601 200 601C166.7 601 133.3 601 100 601C66.7 601 33.3 601 16.7 601L0 601Z" fill="#ebd0cb"/>
      </svg>
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-3 flex items-center text-ashmocha hover:text-charcoalcocoa"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
            <div className="!mt-4 animate-fade-in-up rounded-lg bg-pistachiomist/40 p-3 animate-in fade-in-20 slide-in-from-bottom-2 duration-500 ease-out">
              <div className="flex items-center space-x-2">
                <Info size={18} className="flex-shrink-0 text-ashmocha" />
                <p className="text-xs text-ashmocha">
                  Credentials have been prefilled. <br />
                  Click login to start exploring the demo.
                </p>
              </div>
            </div>
            <Button type="submit" className="w-full bg-deeproseblush text-white hover:bg-deeproseblush/90 hover:shadow-sm !mt-4" loading={isLoading}>
              Login
            </Button>
            {error && <p className="text-sm text-errorred text-center">{error}</p>}
          </form>
        </div>
      </div>
      </div>
    </div>
  );
} 