"use client";

import { useState } from "react";
import { z } from "zod";
import { Confirmation } from "./Confirmation";
import { RepositorySelector } from "./RepositorySelector";
import { TextInputStep } from "./TextInputStep";
import { TriggerSelector } from "./TriggerSelector";
import type { RepositoryConfig } from "@/lib/db/schema";

const RepositorySchema = z.object({
  full_name: z.string(),
  default_branch: z.string(),
});

const WizardDataSchema = z.object({
  selectedRepo: RepositorySchema.nullable(),
  testPattern: z.string(),
  triggers: z.object({
    onPush: z.boolean(),
    onPullRequest: z.boolean(),
  }),
});

export type Repository = z.infer<typeof RepositorySchema>;
export type WizardData = z.infer<typeof WizardDataSchema>;

interface ShortestWizardProps {
  onComplete: () => void;
  onStepChange: (step: number) => void;
  existingConfigs: RepositoryConfig[];
}

const ShortestWizard = ({
  onComplete,
  onStepChange,
  existingConfigs,
}: ShortestWizardProps) => {
  const [step, setStep] = useState(0);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [wizardData, setWizardData] = useState<WizardData>({
    selectedRepo: null,
    testPattern: "",
    triggers: { onPush: false, onPullRequest: false },
  });

  const nextStep = () => {
    const validationResult = WizardDataSchema.safeParse(wizardData);
    if (validationResult.success) {
      const nextStepValue = Math.min(step + 1, 3);
      setStep(nextStepValue);
      onStepChange(nextStepValue);
    }
  };

  const prevStep = () => {
    const prevStepValue = Math.max(step - 1, 0);
    setStep(prevStepValue);
    onStepChange(prevStepValue);
  };

  const handleWizardDataChange = (data: WizardData) => {
    const validationResult = WizardDataSchema.safeParse(data);
    if (validationResult.success) {
      setWizardData(data);
    }
  };

  return (
    <div>
      {step === 0 && (
        <RepositorySelector
          wizardData={wizardData}
          setWizardData={handleWizardDataChange}
          nextStep={nextStep}
          repositories={repositories}
          setRepositories={setRepositories}
          existingConfigs={existingConfigs}
        />
      )}

      {step === 1 && (
        <TextInputStep
          wizardData={wizardData}
          setWizardData={handleWizardDataChange}
          nextStep={nextStep}
          prevStep={prevStep}
          field="testPattern"
          placeholder="**/*.test.ts"
        />
      )}

      {step === 2 && (
        <TriggerSelector
          wizardData={wizardData}
          setWizardData={handleWizardDataChange}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      )}

      {step === 3 && (
        <Confirmation
          wizardData={wizardData}
          prevStep={prevStep}
          onComplete={onComplete}
        />
      )}
    </div>
  );
};

export { ShortestWizard };
