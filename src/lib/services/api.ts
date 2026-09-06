export const API_ORIGIN = "https://nilzone.tds.wiki";
export const SHORT_ORIGIN = "https://tds.wiki";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_ORIGIN}${path}`, {
		credentials: "include",
		...init,
	});
	if (!res.ok) {
		const text = (await res.text()).trim();
		if (text.startsWith("{")) {
			const j = JSON.parse(text) as { error?: string };
			if (j.error) throw new Error(j.error);
		}
		throw new Error(text || `Request failed (${res.status})`);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export function json(method: string, body: unknown): RequestInit {
	return {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	};
}
