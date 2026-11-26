import { resolveNativeIntentPath } from "@/navigation/native-intent";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return resolveNativeIntentPath(path);
}
