export interface ParsedMessage {
  command: string;
  args: string[];
  control: string;
}

export type ParseError = "E103" | "E104";

export function parseMessage(message: string): ParsedMessage | ParseError {
  const segments = message.split(";");
  if (segments.length < 2) {
    return "E103";
  }
  if (segments.some((segment) => segment.length === 0)) {
    return "E104";
  }
  const command = segments[0] ?? "";
  const control = segments[segments.length - 1] ?? "";
  return {
    command,
    args: segments.slice(1, -1),
    control,
  };
}

export function isPing(command: string): boolean {
  return command.toUpperCase() === "PING";
}
