import type { SurveyFieldSpec } from '../../types';

export const SURVEY_FIELD_REGISTRY: Record<string, SurveyFieldSpec> = {
  A1a: { kind: 'dropdown', colKey: 'a1aColIdx' },
  A1b: { kind: 'dropdown', colKey: 'a1bColIdx' },
  A1c: { kind: 'yesNo', colKey: 'a1cColIdx' },
  A2: { kind: 'text', colKey: 'a2ColIdx' },
  A3: { kind: 'text', colKey: 'a3ColIdx' },
  A4: { kind: 'text', colKey: 'a4ColIdx' },
  A4a: { kind: 'text', colKey: 'a4aColIdx' },
  A4b: { kind: 'text', colKey: 'a4bColIdx' },
  A5: { kind: 'text', colKey: 'a5ColIdx' },
  A6: { kind: 'optionalText', colKey: 'a6ColIdx' },
  A7: { kind: 'optionalText', colKey: 'a7ColIdx' },
  A8: { kind: 'optionalText', colKey: 'a8ColIdx' },
  C4: { kind: 'date', colKey: 'c4ColIdx' },
  C5: { kind: 'date', colKey: 'c5ColIdx' },
};

export const DROPDOWN_OPEN_ATTEMPTS = 5;
export const DROPDOWN_OPEN_RETRY_MS = 200;
