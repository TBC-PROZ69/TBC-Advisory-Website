const VISITOR_ERROR =
  "We could not send your request. Please try again in a moment.";

export function stripInquiryQuery() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("sent") || url.searchParams.has("error")) {
    window.history.replaceState({}, "", url.pathname);
  }
}

export async function submitSiteForm(
  url: string,
  payload: Record<string, string>,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data: { ok?: boolean; error?: string } = {};
  try {
    data = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    data = {};
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || VISITOR_ERROR);
  }
}
