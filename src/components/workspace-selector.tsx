'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Building } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// We'll use simple serializable props instead of complex types
interface SerializableWorkspace {
  id: string;
  name: string;
  creator?: string; // Add creator field
  createdAt?: Date; // Add createdAt for sorting/display
}

interface WorkspaceSelectorProps {
  currentWorkspaceId: string;
  workspaces: SerializableWorkspace[];
}

export function WorkspaceSelector({ currentWorkspaceId, workspaces }: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="hover:bg-muted/50 flex items-center gap-1 px-2 font-medium"
        >
          <Building className="text-muted-foreground h-4 w-4" />
          <span className="max-w-[120px] truncate md:max-w-[180px]">
            {currentWorkspace?.name || 'Select workspace'}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Find workspace..." className="text-sm" />
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
                  className="text-sm"
                >
                  <Link
                    href={`/workspace/${workspace.id}`}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="flex-1 truncate font-medium">{workspace.name}</span>
                      {workspace.creator && (
                        <span className="text-muted-foreground text-xs">
                          Created by {workspace.creator}
                        </span>
                      )}
                    </div>
                    {workspace.id === currentWorkspaceId && (
                      <Check className="ml-auto h-3.5 w-3.5" />
                    )}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-2">
            <Button asChild variant="ghost" size="sm" className="w-full justify-start text-sm">
              <Link href="/workspace/create">Create New Workspace</Link>
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
