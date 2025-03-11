"use client";

import type { WizardData } from "./wizard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TriggerSelectorProps {
  wizardData: WizardData;
  setWizardData: (data: WizardData) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TriggerSelector = ({
  wizardData,
  setWizardData,
  nextStep,
  prevStep,
}: TriggerSelectorProps) => {
  const handleTriggerChange = (name: keyof WizardData["triggers"]) => {
    setWizardData({
      ...wizardData,
      triggers: {
        ...wizardData.triggers,
        [name]: !wizardData.triggers[name],
      },
    });
  };

  const isValid =
    wizardData.triggers.onPush || wizardData.triggers.onPullRequest;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="onPush"
            checked={wizardData.triggers.onPush}
            onCheckedChange={() => handleTriggerChange("onPush")}
          />
          <Label htmlFor="onPush">
            Run on push to {wizardData.selectedRepo?.default_branch}
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="onPullRequest"
            checked={wizardData.triggers.onPullRequest}
            onCheckedChange={() => handleTriggerChange("onPullRequest")}
          />
          <Label htmlFor="onPullRequest">Run on pull requests</Label>
        </div>
      </div>

      <div className="flex justify-between">
        <Button onClick={prevStep} variant="outline">
          Back
        </Button>
        <Button onClick={nextStep} disabled={!isValid}>
          Next
        </Button>
      </div>
    </div>
  );
};

export { TriggerSelector };
