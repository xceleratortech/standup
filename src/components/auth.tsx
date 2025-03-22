'use client';

import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SignUp } from '@/components/sign-up';
import SignIn from './sign-in';

export function Authenticate() {
  const [selectedTab, setSelectedTab] = useState<'login' | 'signup'>('login');
  const [transitioning, setTransitioning] = useState(false);

  // Fix the ref type to be specific to HTMLDivElement
  const signInRef = useRef<HTMLDivElement>(null);
  const signUpRef = useRef<HTMLDivElement>(null);

  // Rest of the component remains the same
  const handleTabChange = (value: string) => {
    setTransitioning(true);
    setSelectedTab(value as 'login' | 'signup');
    setTimeout(() => {
      setTransitioning(false);
    }, 300);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
        <CardDescription>Sign in or create an account to get started</CardDescription>
      </CardHeader>

      <Tabs
        defaultValue="login"
        value={selectedTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div className="px-6">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Sign Up
            </TabsTrigger>
          </TabsList>
        </div>

        <div
          className="relative overflow-hidden"
          style={{
            height:
              selectedTab === 'login'
                ? signInRef.current?.offsetHeight
                : signUpRef.current?.offsetHeight,
          }}
        >
          <div
            ref={signInRef}
            className="absolute top-0 w-full"
            style={{
              opacity: selectedTab === 'login' ? 1 : 0,
              transform: `translateX(${selectedTab === 'login' ? 0 : -20}px)`,
              transition: 'opacity 0.3s, transform 0.3s',
              pointerEvents: selectedTab === 'login' ? 'auto' : 'none',
            }}
          >
            <SignIn />
          </div>

          <div
            ref={signUpRef}
            className="absolute top-0 w-full"
            style={{
              opacity: selectedTab === 'signup' ? 1 : 0,
              transform: `translateX(${selectedTab === 'signup' ? 0 : 20}px)`,
              transition: 'opacity 0.3s, transform 0.3s',
              pointerEvents: selectedTab === 'signup' ? 'auto' : 'none',
            }}
          >
            <SignUp />
          </div>
        </div>
      </Tabs>
    </Card>
  );
}
