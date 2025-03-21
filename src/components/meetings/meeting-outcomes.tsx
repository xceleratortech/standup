'use client';

import {
  ListChecks,
  Plus,
  FileText,
  CheckCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useMeetingOutcomes, useDeleteOutcome } from '@/lib/hooks/use-queries';
import { Spinner } from '@/components/ui/spinner';

interface MeetingOutcomesProps {
  meetingId: string;
  canEdit: boolean;
  initialOutcomes?: any[];
}

export default function MeetingOutcomes({
  meetingId,
  canEdit,
  initialOutcomes = [],
}: MeetingOutcomesProps) {
  const { data: outcomes = initialOutcomes, isLoading } =
    useMeetingOutcomes(meetingId);
  const { mutate: deleteOutcome, isPending: isDeleting } = useDeleteOutcome();

  const getIconForType = (type: string) => {
    switch (type.toLowerCase()) {
      case 'summary':
        return <FileText className='h-4 w-4' />;
      case 'action items':
        return <CheckCircle className='h-4 w-4' />;
      default:
        return <ListChecks className='h-4 w-4' />;
    }
  };

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Spinner />
      </div>
    );
  }

  if (outcomes.length === 0) {
    return (
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            <ListChecks className='h-5 w-5' />
            Outcomes
          </h2>
          {canEdit && (
            <Button size='sm' className='gap-1'>
              <Plus className='h-4 w-4' />
              Add Outcome
            </Button>
          )}
        </div>

        <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center'>
          <p>No outcomes have been added yet.</p>
          {canEdit && (
            <p className='mt-2 text-sm'>
              Add a summary or action items from this meeting to keep track of
              important points.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-xl font-semibold'>
          <ListChecks className='h-5 w-5' />
          Outcomes
        </h2>
        {canEdit && (
          <Button size='sm' className='gap-1'>
            <Plus className='h-4 w-4' />
            Add Outcome
          </Button>
        )}
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {outcomes.map((outcome) => (
          <Card key={outcome.id}>
            <CardHeader className='pb-2'>
              <div className='flex items-start justify-between'>
                <Badge variant='outline' className='flex items-center gap-1'>
                  {getIconForType(outcome.type)}
                  <span className='capitalize'>{outcome.type}</span>
                </Badge>

                {canEdit && (
                  <div className='flex gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8'>
                      <Edit className='text-muted-foreground h-4 w-4' />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          disabled={isDeleting}
                        >
                          <Trash2 className='text-muted-foreground hover:text-destructive h-4 w-4' />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Outcome</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this outcome? This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              deleteOutcome(outcome.id);
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-line'>{outcome.content}</p>
            </CardContent>
            <CardFooter className='text-muted-foreground pt-2 text-xs'>
              Added{' '}
              {formatDistanceToNow(new Date(outcome.createdAt), {
                addSuffix: true,
              })}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
