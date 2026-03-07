const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }

  if (!configuredBasePath) {
    return path;
  }

  return `${configuredBasePath}${path}`;
}

