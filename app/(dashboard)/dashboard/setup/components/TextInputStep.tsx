"use client";

import type { WizardData } from "./ShortestWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TextInputStepProps {
  wizardData: WizardData;
  setWizardData: (data: WizardData) => void;
  nextStep: () => void;
  prevStep: () => void;
  field: keyof Pick<WizardData, "testFolder" | "testPattern">;
  placeholder: string;
}

const TextInputStep = ({
  wizardData,
  setWizardData,
  nextStep,
  prevStep,
  field,
  placeholder,
}: TextInputStepProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWizardData({ ...wizardData, [field]: e.target.value });
  };

  return (
    <div className="space-y-6">
      <Input
        value={wizardData[field]}
        onChange={handleChange}
        placeholder={placeholder}
      />

      <div className="flex justify-between">
        <Button onClick={prevStep} variant="outline">
          Back
        </Button>
        <Button onClick={nextStep} disabled={!wizardData[field].trim()}>
          Next
        </Button>
      </div>
    </div>
  );
};

export { TextInputStep };
