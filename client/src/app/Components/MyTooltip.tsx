import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TooltipProps{
    content:string,
    trigger:any
}

export function MyTooltip({content, trigger}:TooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {trigger}
        </TooltipTrigger>
        <TooltipContent className="bg-[var(--text1)]
        border-[1px] rounded-xl border-neutral-700">
          <p className="text-white text-base font-medium">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
