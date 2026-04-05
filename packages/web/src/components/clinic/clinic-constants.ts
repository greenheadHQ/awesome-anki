import { CheckCircle, Clock, Copy, Link2, Sparkles, Trash2 } from "lucide-react";

/** 6종 검증 유형 (ClinicWorkspace + ClinicValidationPanel 공유) */
export const VALIDATION_TYPES = [
	{ key: "factCheck", icon: CheckCircle, label: "팩트 체크" },
	{ key: "freshness", icon: Clock, label: "최신성 검사" },
	{ key: "similarity", icon: Copy, label: "유사성 검사" },
	{ key: "context", icon: Link2, label: "문맥 일관성" },
	{ key: "verbose", icon: Sparkles, label: "Verbose 감지" },
	{ key: "yagni", icon: Trash2, label: "YAGNI 감지" },
] as const;
