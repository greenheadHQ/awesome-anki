import { FlaskConical, Loader2 } from "lucide-react";

import type { Experiment } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export interface ExperimentsTabProps {
  experiments: Experiment[];
  isLoading: boolean;
}

export function ExperimentsTab({ experiments, isLoading }: ExperimentsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm">A/B 테스트</CardTitle>
        <Button size="sm" variant="outline">
          <FlaskConical className="w-4 h-4 mr-1" />새 실험
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto">
        {experiments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>실험이 없습니다</p>
            <p className="text-xs mt-1">두 버전을 비교하는 A/B 테스트를 시작해보세요</p>
          </div>
        ) : (
          <div className="divide-y">
            {experiments.map((exp) => (
              <div key={exp.id} className="p-4 hover:bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{exp.name}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      exp.status === "running" && "bg-blue-100 text-blue-700",
                      exp.status === "completed" && "bg-gray-100 text-gray-700",
                    )}
                  >
                    {exp.status === "running" ? "진행 중" : "완료"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span>{exp.controlVersionId}</span>
                  <span className="mx-2">vs</span>
                  <span>{exp.treatmentVersionId}</span>
                </div>
                {exp.status === "completed" && exp.winnerVersionId && (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600 font-medium">우승: {exp.winnerVersionId}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
