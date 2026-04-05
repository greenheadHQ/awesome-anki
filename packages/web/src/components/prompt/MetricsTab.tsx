import type { PromptVersion } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { MetricCard } from "./MetricCard";

export interface MetricsTabProps {
  versions: PromptVersion[];
}

export function MetricsTab({ versions }: MetricsTabProps) {
  // 전체 통계 계산
  const totalSplits = versions.reduce((sum, v) => sum + (v.metrics?.totalSplits || 0), 0);
  const avgApprovalRate =
    versions.length > 0
      ? versions.reduce((sum, v) => sum + (v.metrics?.approvalRate || 0), 0) / versions.length
      : 0;
  const avgCharCount =
    versions.length > 0
      ? versions.reduce((sum, v) => sum + (v.metrics?.avgCharCount || 0), 0) / versions.length
      : 0;

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {/* 전체 통계 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">전체 통계</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 xl:gap-4">
            <MetricCard label="총 분할 수" value={totalSplits} />
            <MetricCard
              label="평균 승인률"
              value={`${Math.round(avgApprovalRate * 100)}%`}
              color={avgApprovalRate >= 0.8 ? "green" : avgApprovalRate >= 0.5 ? "yellow" : "red"}
            />
            <MetricCard label="평균 글자 수" value={Math.round(avgCharCount)} />
            <MetricCard label="버전 수" value={versions.length} />
          </div>
        </CardContent>
      </Card>

      {/* 버전별 비교 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">버전별 성능 비교</CardTitle>
        </CardHeader>
        <CardContent className="px-4 overflow-x-auto">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">버전 데이터가 없습니다</div>
          ) : (
            <Table className="text-sm">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="text-left px-4 py-2">버전</TableHead>
                  <TableHead className="text-right px-4 py-2">분할 수</TableHead>
                  <TableHead className="text-right px-4 py-2">승인률</TableHead>
                  <TableHead className="hidden xl:table-cell text-right px-4 py-2">
                    수정률
                  </TableHead>
                  <TableHead className="hidden xl:table-cell text-right px-4 py-2">
                    거부율
                  </TableHead>
                  <TableHead className="hidden xl:table-cell text-right px-4 py-2">
                    평균 글자
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {versions.map((version) => (
                  <TableRow key={version.id} className="hover:bg-muted/50">
                    <TableCell className="px-4 py-2 font-medium">{version.name}</TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      {version.metrics?.totalSplits || 0}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      <span
                        className={cn(
                          (version.metrics?.approvalRate || 0) >= 0.8 && "text-green-600",
                          (version.metrics?.approvalRate || 0) < 0.5 && "text-red-600",
                        )}
                      >
                        {Math.round((version.metrics?.approvalRate || 0) * 100)}%
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell px-4 py-2 text-right text-yellow-600">
                      {Math.round((version.metrics?.modificationRate || 0) * 100)}%
                    </TableCell>
                    <TableCell className="hidden xl:table-cell px-4 py-2 text-right text-red-600">
                      {Math.round((version.metrics?.rejectionRate || 0) * 100)}%
                    </TableCell>
                    <TableCell className="hidden xl:table-cell px-4 py-2 text-right">
                      {Math.round(version.metrics?.avgCharCount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
