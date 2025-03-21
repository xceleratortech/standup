'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// We'll use simple serializable props instead of complex types
interface SerializableWorkspace {
  id: string;
  name: string;
}

interface WorkspaceSelectorProps {
  currentWorkspaceId: string;
  workspaces: SerializableWorkspace[];
}

export function WorkspaceSelector({
  currentWorkspaceId,
  workspaces,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between border-gray-200 bg-white md:w-[260px]'
        >
          {workspaces.find((workspace) => workspace.id === currentWorkspaceId)
            ?.name || 'Select workspace...'}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-full p-0 md:w-[260px]'>
        <Command>
          <CommandInput placeholder='Search workspace...' />
          <CommandEmpty>No workspace found.</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={workspace.name}
                  onSelect={() => {
                    setOpen(false);
                  }}
                >
                  <Link
                    href={`/workspace/${workspace.id}`}
                    className='flex w-full items-center justify-between'
                  >
                    <span className='flex-1 truncate'>{workspace.name}</span>
                    {workspace.id === currentWorkspaceId && (
                      <Check className='ml-auto h-4 w-4' />
                    )}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className='border-t p-2'>
            <Button
              asChild
              variant='ghost'
              size='sm'
              className='w-full justify-start text-sm'
            >
              <Link href='/workspace/create'>Create New Workspace</Link>
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
