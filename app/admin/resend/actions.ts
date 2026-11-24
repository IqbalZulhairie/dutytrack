"use server";

export type TestEmailState = {
  status: "idle" | "success" | "error";
  message: string;
};

function isValidSender(value: string) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(value)) return true;
  const displayNameAddress = value.match(/^(.+?)\s*<([^<>]+)>$/);
  return Boolean(displayNameAddress?.[1].trim() && emailPattern.test(displayNameAddress[2]));
}

export async function sendTestEmail(
  _previousState: TestEmailState,
  formData: FormData,
): Promise<TestEmailState> {
  if (_previousState.status === "success") {
    return _previousState;
  }
  if (formData.has("recipient")) {
    return { status: "error", message: "The recipient is fixed by server configuration." };
  }
  if (process.env.NODE_ENV === "production") {
    return { status: "error", message: "Test email sending is disabled in production." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.RESEND_TEST_RECIPIENT?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

  if (!apiKey) {
    return { status: "error", message: "RESEND_API_KEY is not configured on the server." };
  }
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { status: "error", message: "Set a valid RESEND_TEST_RECIPIENT email address on the server." };
  }
  if (!isValidSender(from)) {
    return { status: "error", message: "RESEND_FROM_EMAIL must be a valid Resend sender address." };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: "Duty Track email delivery test",
        html: "<p>This is a test email from Duty Track.</p><p>No cleaning duty was created or scheduled.</p>",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    return { status: "error", message: `Could not connect to Resend: ${message}` };
  }

  let result: Record<string, unknown>;
  try {
    const payload: unknown = await response.json();
    result = typeof payload === "object" && payload !== null
      ? payload as Record<string, unknown>
      : {};
  } catch {
    return { status: "error", message: `Resend returned an unreadable response (HTTP ${response.status}).` };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: typeof result.message === "string"
        ? result.message
        : `Resend rejected the request (HTTP ${response.status}).`,
    };
  }

  return {
    status: "success",
    message: typeof result.id === "string"
      ? `Resend accepted the test email. Message ID: ${result.id}`
      : "Resend accepted the test email.",
  };
}
