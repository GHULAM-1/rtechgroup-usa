import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedCellProps {
  content: string;
  maxLength?: number;
  className?: string;
}

export function TruncatedCell({ content, maxLength = 30, className }: TruncatedCellProps) {
  const shouldTruncate = content.length > maxLength;
  const truncated = shouldTruncate ? `${content.slice(0, maxLength)}...` : content;

  if (!shouldTruncate) {
    return <span className={className}>{content}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("cursor-help", className)}>{truncated}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}