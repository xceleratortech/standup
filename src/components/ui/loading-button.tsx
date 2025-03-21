import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

export function LoadingButton({
  children,
  isLoading = false,
  loadingText,
  variant = 'default',
  size = 'default',
  className,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          {loadingText || 'Loading...'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
