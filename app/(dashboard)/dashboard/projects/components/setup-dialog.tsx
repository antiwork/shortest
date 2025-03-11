"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShortestWizard } from "./wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Project } from "@/lib/db/schema";

const steps = [
  {
    title: "Select Repository",
    description: "Choose which repository you want to set up QA automation for",
  },
  {
    title: "Configure Test Pattern",
    description: "Define how to identify your test files (e.g., **/*.test.ts)",
  },
  {
    title: "Configure Triggers",
    description: "Choose when to run your QA automation",
  },
  {
    title: "Review QA Automation",
    description: "Review your configuration before setting up",
  },
];

interface SetupDialogProps {
  projects: Project[];
}

export const SetupDialog = ({ projects }: SetupDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{steps[step].title}</DialogTitle>
          <DialogDescription>{steps[step].description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <ShortestWizard
            onComplete={handleComplete}
            onStepChange={setStep}
            existingProjects={projects}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
