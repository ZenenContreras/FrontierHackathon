export type ResponsePayload =
  | { kind: "json"; value: unknown }
  | { kind: "text"; value: string }
  | { kind: "empty" };

export interface CommandResult {
  status: number;
  payload: ResponsePayload;
}
