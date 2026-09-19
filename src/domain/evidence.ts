export type EvidenceClass = 'observed' | 'candidate' | 'inferred';

export interface FieldEvidence {
  readonly normalizedField: string;
  readonly sourceTable: string;
  readonly sourceField: string;
  readonly transform: string;
  readonly classification: EvidenceClass;
  readonly reference?: string;
}

export interface ParserWarning {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
}
