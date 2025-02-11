import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FilterOptionProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  capitalize?: boolean;
}

function FilterOption({
  id,
  label,
  checked,
  onCheckedChange,
  capitalize = false,
}: FilterOptionProps) {
  return (
    <div className="flex items-center space-x-2 p-2 hover:bg-accent hover:text-accent-foreground">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <label
        htmlFor={id}
        className={`flex-grow text-sm cursor-pointer ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {label}
      </label>
    </div>
  );
}

interface FilterSectionProps {
  label: string;
  buttonText: string;
  options: string[];
  selectedOptions: string[];
  onOptionChange: (value: string) => void;
  capitalize?: boolean;
  disabled?: boolean;
}

function FilterSection({
  label,
  buttonText,
  options,
  selectedOptions,
  onOptionChange,
  capitalize = false,
  disabled = false,
}: FilterSectionProps) {
  return (
    <div className="flex flex-col space-y-1.5">
      <label
        htmlFor={`${label.toLowerCase()}-filter`}
        className="text-sm font-medium text-muted-foreground"
      >
        {label}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={`${label.toLowerCase()}-filter`}
            variant="outline"
            role="combobox"
            className="w-full sm:w-[200px] justify-between"
            disabled={disabled}
          >
            {buttonText}
            <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {!disabled && (
          <PopoverContent className="w-full sm:w-[200px] p-0">
            <div className="max-h-[300px] overflow-y-auto">
              {options.map((option) => (
                <FilterOption
                  key={option}
                  id={option}
                  label={option}
                  checked={selectedOptions.includes(option)}
                  onCheckedChange={() => onOptionChange(option)}
                  capitalize={capitalize}
                />
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

interface PullRequestFilterProps {
  uniqueRepositories: string[];
  selectedRepoFilters: string[];
  buildStatusFilter: string[];
  onRepoFilterChange: (value: string) => void;
  onBuildStatusFilterChange: (value: string) => void;
}

export function PullRequestFilter({
  uniqueRepositories,
  selectedRepoFilters,
  buildStatusFilter,
  onRepoFilterChange,
  onBuildStatusFilterChange,
}: PullRequestFilterProps) {
  const buildStatusOptions = ["success", "failure", "pending", "unknown"];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <FilterSection
        label="Repositories"
        buttonText={
          selectedRepoFilters.length === 0
            ? "Filter Repositories"
            : `${selectedRepoFilters.length} selected`
        }
        options={uniqueRepositories}
        selectedOptions={selectedRepoFilters}
        onOptionChange={onRepoFilterChange}
        capitalize={false}
        disabled={uniqueRepositories.length === 0}
      />
      <FilterSection
        label="Build Status"
        buttonText={
          buildStatusFilter.length === 0
            ? "Filter Build Status"
            : `${buildStatusFilter.length} selected`
        }
        options={buildStatusOptions}
        selectedOptions={buildStatusFilter}
        onOptionChange={onBuildStatusFilterChange}
        capitalize={true}
        disabled={buildStatusOptions.length === 0}
      />
    </div>
  );
}
