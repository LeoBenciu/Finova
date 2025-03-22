
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TooltipProps {
    trigger: React.ReactElement;
    tip: string
  }

export function TooltipDemo({trigger,tip}:TooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
            {trigger}
        </TooltipTrigger>
        <TooltipContent className="bg-[var(--primary)] font-bold">
          <p>{tip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
