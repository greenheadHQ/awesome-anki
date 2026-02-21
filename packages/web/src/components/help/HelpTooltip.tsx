import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { type HelpItem, helpContent } from "../../lib/helpContent";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface HelpTooltipProps {
  /** helpContent에 정의된 키 */
  helpKey: keyof typeof helpContent;
  /** 커스텀 도움말 (helpKey 대신 사용) */
  custom?: HelpItem;
  /** 아이콘 크기 */
  size?: "sm" | "md";
  /** 추가 클래스 */
  className?: string;
}

export function HelpTooltip({
  helpKey,
  custom,
  size = "sm",
  className = "",
}: HelpTooltipProps) {
  const content = custom || helpContent[helpKey];

  if (!content) {
    console.warn(`HelpTooltip: helpKey "${helpKey}" not found`);
    return null;
  }

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted p-0.5 transition-colors cursor-pointer ${className}`}
          aria-label={`${content.title} 도움말`}
        >
          <HelpCircle className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{content.title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {content.description}
          </p>
          {content.learnMore && (
            <Link
              to={content.learnMore}
              className="inline-block text-xs text-primary hover:underline mt-1"
            >
              자세히 알아보기 &rarr;
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
