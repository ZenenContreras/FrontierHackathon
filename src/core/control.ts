export type ControlCheck = "ok" | "malformed" | "invalid";

// (1 - 3R) mod 97. R is the integer of the payload without the control segment:
// A-Z/a-z become 1..26, digits stay digits, and any other character is dropped.
// This matches every recorded valid and invalid control, and the closed forms
// (17-3n), (41-3n) and (75-3n). PING does not call this check.
export function expectedControl(command: string, args: string[]): number {
  let digits = "";
  for (const char of `${command};${args.join(";")}`) {
    if (char >= "0" && char <= "9") {
      digits += char;
    } else if ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z")) {
      digits += String(char.toUpperCase().charCodeAt(0) - 64);
    }
  }
  const residue = digits.length === 0 ? 0n : BigInt(digits) % 97n;
  return Number((1n - 3n * residue + 97n * 4n) % 97n);
}

export function checkControl(command: string, args: string[], control: string): ControlCheck {
  if (!/^\d+$/.test(control)) {
    return "malformed";
  }
  return BigInt(control) === BigInt(expectedControl(command, args)) ? "ok" : "invalid";
}
