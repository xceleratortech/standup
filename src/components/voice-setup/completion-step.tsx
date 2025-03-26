import { Button } from '@/components/ui/button';
import { Check, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface CompletionStepProps {
  onReturnToWorkspace: () => void;
  onReviewSamples: () => void;
}

export function CompletionStep({ onReturnToWorkspace, onReviewSamples }: CompletionStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Voice Identity Complete!</h1>
        <p className="text-muted-foreground text-lg">
          You've successfully set up your voice identity with Standup
        </p>
      </div>

      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Check className="h-6 w-6 text-green-700 dark:text-green-300" />
            </div>
          </div>
          <CardTitle className="text-center">All Voice Samples Recorded</CardTitle>
          <CardDescription className="text-center">
            Your voice identity is now ready to use with all Standup features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium">Accurate Attribution in Transcripts</h3>
                <p className="text-muted-foreground text-sm">
                  Your speech will be correctly attributed to you in meeting transcripts
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium">Personalized Insights</h3>
                <p className="text-muted-foreground text-sm">
                  We'll identify your contributions and provide personalized summaries and insights
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-medium">Action Item Tracking</h3>
                <p className="text-muted-foreground text-sm">
                  Action items assigned to you will be properly tracked and highlighted
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-blue-50 p-4 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm">
                  You can always update your voice samples later by returning to this page from your
                  workspace home page.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button className="w-full" onClick={onReturnToWorkspace}>
            Return to Workspace
          </Button>

          <Button variant="outline" onClick={onReviewSamples}>
            Review Voice Samples
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
