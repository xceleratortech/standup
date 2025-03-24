'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface PulsingVoiceButtonProps extends React.ComponentProps<typeof Button> {
  needsAttention: boolean;
}

export const PulsingVoiceButton = ({
  children,
  needsAttention,
  ...props
}: PulsingVoiceButtonProps) => {
  if (!needsAttention) {
    return <Button {...props}>{children}</Button>;
  }

  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        boxShadow: [
          '0 0 0 rgba(59, 130, 246, 0)',
          '0 0 10px rgba(59, 130, 246, 0.5)',
          '0 0 0 rgba(59, 130, 246, 0)',
        ],
      }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: 'easeInOut',
      }}
      className="inline-flex"
    >
      <Button {...props}>{children}</Button>
    </motion.div>
  );
};

export default PulsingVoiceButton;
