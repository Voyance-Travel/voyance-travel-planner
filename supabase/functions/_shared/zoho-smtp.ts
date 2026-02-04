// Zoho SMTP email sender using raw SMTP protocol with TLS (port 465)

const ZOHO_SMTP_USER = Deno.env.get("ZOHO_SMTP_USER") || "contact@travelwithvoyance.com";
const ZOHO_SMTP_PASSWORD = Deno.env.get("ZOHO_SMTP_PASSWORD");

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

class SMTPConnection {
  private conn: Deno.TlsConn | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";

  async connect(): Promise<boolean> {
    try {
      this.conn = await Deno.connectTls({
        hostname: "smtp.zoho.com",
        port: 465,
      });
      return true;
    } catch (error) {
      console.error("[zoho-smtp] Connection failed:", error);
      return false;
    }
  }

  private async readLine(): Promise<string> {
    if (!this.conn) throw new Error("Not connected");
    
    while (!this.buffer.includes("\r\n")) {
      const chunk = new Uint8Array(1024);
      const n = await this.conn.read(chunk);
      if (n === null) break;
      this.buffer += this.decoder.decode(chunk.subarray(0, n));
    }

    const idx = this.buffer.indexOf("\r\n");
    if (idx === -1) {
      const result = this.buffer;
      this.buffer = "";
      return result;
    }

    const line = this.buffer.substring(0, idx);
    this.buffer = this.buffer.substring(idx + 2);
    return line;
  }

  async readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    let code = 0;

    while (true) {
      const line = await this.readLine();
      lines.push(line);
      
      // Parse response code
      const match = line.match(/^(\d{3})([ -])/);
      if (match) {
        code = parseInt(match[1], 10);
        // If it's a space (not hyphen), this is the last line
        if (match[2] === " ") break;
      } else {
        break;
      }
    }

    return { code, lines };
  }

  async sendCommand(command: string): Promise<{ code: number; lines: string[] }> {
    if (!this.conn) throw new Error("Not connected");
    await this.conn.write(this.encoder.encode(command + "\r\n"));
    return await this.readResponse();
  }

  async sendData(data: string): Promise<{ code: number; lines: string[] }> {
    if (!this.conn) throw new Error("Not connected");
    await this.conn.write(this.encoder.encode(data));
    return await this.readResponse();
  }

  close() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // Ignore
      }
      this.conn = null;
    }
  }
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text, replyTo, fromName = "Voyance" } = options;

  if (!ZOHO_SMTP_PASSWORD) {
    console.error("[zoho-smtp] ZOHO_SMTP_PASSWORD not configured");
    return { success: false, error: "ZOHO_SMTP_PASSWORD not configured" };
  }

  const smtp = new SMTPConnection();

  try {
    // Connect
    const connected = await smtp.connect();
    if (!connected) {
      return { success: false, error: "Failed to connect to SMTP server" };
    }

    // Read greeting
    const greeting = await smtp.readResponse();
    console.log("[zoho-smtp] Greeting:", greeting.code);
    if (greeting.code !== 220) {
      throw new Error(`Unexpected greeting: ${greeting.lines.join(" ")}`);
    }

    // EHLO
    const ehlo = await smtp.sendCommand("EHLO voyance.app");
    console.log("[zoho-smtp] EHLO:", ehlo.code);
    if (ehlo.code !== 250) {
      throw new Error(`EHLO failed: ${ehlo.lines.join(" ")}`);
    }

    // AUTH LOGIN
    const auth = await smtp.sendCommand("AUTH LOGIN");
    if (auth.code !== 334) {
      throw new Error(`AUTH LOGIN failed: ${auth.lines.join(" ")}`);
    }

    // Send username (base64)
    const userResp = await smtp.sendCommand(btoa(ZOHO_SMTP_USER));
    if (userResp.code !== 334) {
      throw new Error(`Username rejected: ${userResp.lines.join(" ")}`);
    }

    // Send password (base64)
    const passResp = await smtp.sendCommand(btoa(ZOHO_SMTP_PASSWORD));
    if (passResp.code !== 235) {
      throw new Error(`Authentication failed: ${passResp.lines.join(" ")}`);
    }

    console.log("[zoho-smtp] Authenticated successfully");

    // MAIL FROM
    const mailFrom = await smtp.sendCommand(`MAIL FROM:<${ZOHO_SMTP_USER}>`);
    if (mailFrom.code !== 250) {
      throw new Error(`MAIL FROM failed: ${mailFrom.lines.join(" ")}`);
    }

    // RCPT TO
    const rcptTo = await smtp.sendCommand(`RCPT TO:<${to}>`);
    if (rcptTo.code !== 250) {
      throw new Error(`RCPT TO failed: ${rcptTo.lines.join(" ")}`);
    }

    // DATA
    const dataCmd = await smtp.sendCommand("DATA");
    if (dataCmd.code !== 354) {
      throw new Error(`DATA failed: ${dataCmd.lines.join(" ")}`);
    }

    // Build email content
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@travelwithvoyance.com>`;
    const plainText = text || stripHtml(html);

    const emailLines = [
      `From: ${fromName} <${ZOHO_SMTP_USER}>`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
    ];

    if (replyTo) {
      emailLines.push(`Reply-To: ${replyTo}`);
    }

    emailLines.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      chunk64(btoa(unescape(encodeURIComponent(plainText)))),
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      chunk64(btoa(unescape(encodeURIComponent(html)))),
      "",
      `--${boundary}--`,
      ".",
    );

    const emailContent = emailLines.join("\r\n");
    const sendResp = await smtp.sendData(emailContent + "\r\n");

    if (sendResp.code !== 250) {
      throw new Error(`Send failed: ${sendResp.lines.join(" ")}`);
    }

    console.log(`[zoho-smtp] Email sent successfully to ${to}, messageId: ${messageId}`);

    // QUIT
    await smtp.sendCommand("QUIT");

    return { success: true, messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[zoho-smtp] Failed to send email to ${to}:`, errorMessage);
    return { success: false, error: errorMessage };
  } finally {
    smtp.close();
  }
}

// Encode subject for non-ASCII characters
function encodeSubject(subject: string): string {
  // Check if subject contains non-ASCII characters
  if (/[^\x00-\x7F]/.test(subject)) {
    return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  }
  return subject;
}

// Split base64 into 76-character lines for MIME compliance
function chunk64(base64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.substring(i, i + 76));
  }
  return lines.join("\r\n");
}

// Simple HTML to text converter
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Validate email credentials are configured
export function isConfigured(): boolean {
  return !!ZOHO_SMTP_PASSWORD;
}
