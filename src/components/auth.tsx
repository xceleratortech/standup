'use client';

import SignIn from './sign-in';
import { SignUp } from './sign-up';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useResizeObserver } from '@/lib/use-resize-observer';

export function Authenticate() {
  const [selectedTab, setSelectedTab] = useState('login');
  const [signInRef, signInRect] = useResizeObserver();
  const [signUpRef, signUpRect] = useResizeObserver();

  return (
    <Tabs
      defaultValue='login'
      className='w-full'
      onValueChange={(value) => setSelectedTab(value)}
    >
      <TabsList className='grid w-full grid-cols-2'>
        <TabsTrigger value='login'>Login</TabsTrigger>
        <TabsTrigger value='signup'>Sign Up</TabsTrigger>
      </TabsList>

      <motion.div
        animate={{
          height:
            selectedTab === 'login' ? signInRect?.height : signUpRect?.height,
        }}
        transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
        className='relative overflow-hidden'
        style={{
          height:
            selectedTab === 'login' ? signInRect?.height : signUpRect?.height,
        }}
      >
        <div
          ref={signInRef}
          className='absolute top-0 w-full'
          style={{
            opacity: selectedTab === 'login' ? 1 : 0,
            visibility: selectedTab === 'login' ? 'visible' : 'hidden',
          }}
        >
          <SignIn />
        </div>

        <div
          ref={signUpRef}
          className='absolute top-0 w-full'
          style={{
            opacity: selectedTab === 'signup' ? 1 : 'hidden',
            visibility: selectedTab === 'signup' ? 'visible' : 'hidden',
          }}
        >
          <SignUp />
        </div>
      </motion.div>
    </Tabs>
  );
}
