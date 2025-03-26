import { Button } from '@/components/ui/button';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface IntroductionStepProps {
  onContinue: () => void;
}

export function IntroductionStep({ onContinue }: IntroductionStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-center text-3xl font-bold tracking-tight">Voice Identity Setup</h1>
        <p className="text-muted-foreground text-center text-lg">
          Set up your voice identity to enhance your experience with Standup
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why Voice Identity Is Important</CardTitle>
          <CardDescription>
            Voice identification is a critical component of Standup that enables many of our core
            features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">Accurate Transcription Attribution</h3>
                <p className="text-muted-foreground text-sm">
                  Your voice samples help our system correctly identify who said what in meeting
                  recordings
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">Personalized Meeting Highlights</h3>
                <p className="text-muted-foreground text-sm">
                  Get personalized summaries of what matters most to you in meetings you attend
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">Action Item Tracking</h3>
                <p className="text-muted-foreground text-sm">
                  Automatically identify and track action items assigned to you during meetings
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md bg-amber-50 p-4 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h4 className="font-medium">Voice identity is required</h4>
                <p className="text-sm">
                  Many features of Standup rely on voice identification. Without it, we won't be
                  able to accurately identify your contributions in meetings or generate
                  personalized insights for you.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={onContinue}>
            Continue to Voice Setup
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
