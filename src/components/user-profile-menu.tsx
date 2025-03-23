'use client';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/auth-client';
import { LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import Avvvatars from 'avvvatars-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfileMenuProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

function UserProfileMenu({ user }: UserProfileMenuProps) {
  const [imageError, setImageError] = useState(false);

  const router = useRouter();

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Login</Link>
      </Button>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const avatarValue = user.name || user.email || user.id || 'user';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
          <Avatar className="h-8 w-8">
            {user.image && !imageError ? (
              <img
                src={user.image}
                alt={user.name || 'User avatar'}
                className="h-full w-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <Avvvatars value={avatarValue} size={32} />
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        {/* <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserProfileMenu;
