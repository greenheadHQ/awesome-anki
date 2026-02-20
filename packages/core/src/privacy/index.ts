import { ValidationError } from "../errors.js";

export type PrivacyMode = "standard" | "balanced" | "strict";
export type PrivacyFeature = "split" | "validation" | "embedding";

export interface FeaturePrivacyPolicy {
  enabled: boolean;
  maskSensitive: boolean;
  maxChars: number;
}

export interface PrivacyStatus {
  mode: PrivacyMode;
  description: string;
  featurePolicies: Record<PrivacyFeature, FeaturePrivacyPolicy>;
}

function parseMode(value: string | undefined): PrivacyMode {
  if (value === "balanced" || value === "strict") {
    return value;
  }
  return "standard";
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function getBaseMaskSensitive(mode: PrivacyMode): boolean {
  return mode !== "standard";
}

function getDescription(mode: PrivacyMode): string {
  switch (mode) {
    case "balanced":
      return "민감정보 마스킹 + 길이 제한이 적용된 균형 모드";
    case "strict":
      return "외부 LLM 전송을 차단하는 강력 프라이버시 모드";
    default:
      return "기본 모드 (기능 우선, 필요 시 마스킹/길이 제한 조정 가능)";
  }
}

export function getPrivacyStatus(): PrivacyStatus {
  const mode = parseMode(process.env.ANKI_SPLITTER_PRIVACY_MODE);
  const baseMaskSensitive = getBaseMaskSensitive(mode);
  const maskSensitive = parseBoolean(
    process.env.ANKI_SPLITTER_PRIVACY_MASK_SENSITIVE,
    baseMaskSensitive,
  );
  const strictDisabled = mode === "strict";

  return {
    mode,
    description: getDescription(mode),
    featurePolicies: {
      split: {
        enabled:
          !strictDisabled &&
          parseBoolean(process.env.ANKI_SPLITTER_PRIVACY_SPLIT_ENABLED, true),
        maskSensitive,
        maxChars: parsePositiveInt(
          process.env.ANKI_SPLITTER_PRIVACY_SPLIT_MAX_CHARS,
          mode === "balanced" ? 6000 : 12000,
        ),
      },
      validation: {
        enabled:
          !strictDisabled &&
          parseBoolean(
            process.env.ANKI_SPLITTER_PRIVACY_VALIDATION_ENABLED,
            true,
          ),
        maskSensitive,
        maxChars: parsePositiveInt(
          process.env.ANKI_SPLITTER_PRIVACY_VALIDATION_MAX_CHARS,
          mode === "balanced" ? 4000 : 8000,
        ),
      },
      embedding: {
        enabled:
          !strictDisabled &&
          parseBoolean(
            process.env.ANKI_SPLITTER_PRIVACY_EMBEDDING_ENABLED,
            true,
          ),
        maskSensitive,
        maxChars: parsePositiveInt(
          process.env.ANKI_SPLITTER_PRIVACY_EMBEDDING_MAX_CHARS,
          mode === "balanced" ? 2000 : 4000,
        ),
      },
    },
  };
}

function maskSensitiveData(text: string): string {
  return text
    .replace(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
      "[REDACTED_EMAIL]",
    )
    .replace(
      /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{4}/g,
      "[REDACTED_PHONE]",
    )
    .replace(/https?:\/\/[^\s)]+/g, "[REDACTED_URL]")
    .replace(/\b\d{13,}\b/g, "[REDACTED_ID]");
}

export function sanitizeForExternalAI(
  text: string,
  feature: PrivacyFeature,
): string {
  const { featurePolicies } = getPrivacyStatus();
  const policy = featurePolicies[feature];

  let output = text;

  if (policy.maskSensitive) {
    output = maskSensitiveData(output);
  }

  if (output.length > policy.maxChars) {
    output = output.slice(0, policy.maxChars);
  }

  return output;
}

export function sanitizeListForExternalAI(
  values: string[],
  feature: PrivacyFeature,
): string[] {
  return values.map((value) => sanitizeForExternalAI(value, feature));
}

export function assertExternalAIEnabled(feature: PrivacyFeature): void {
  const { mode, featurePolicies } = getPrivacyStatus();
  if (featurePolicies[feature].enabled) {
    return;
  }

  throw new ValidationError(
    `프라이버시 설정으로 ${feature} 외부 전송이 비활성화되었습니다. (mode: ${mode})`,
  );
}
