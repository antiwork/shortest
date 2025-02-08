export function getShortestEnv(envName: string): string | undefined {
  return process.env[envName] || process.env[`SHORTEST_${envName}`];
}
