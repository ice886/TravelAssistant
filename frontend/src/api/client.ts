export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return response.json();
}
