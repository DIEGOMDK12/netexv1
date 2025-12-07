import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy-key-for-initialization");

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

interface DeliveryEmailParams {
  to: string;
  orderId: number;
  customerName?: string;
  productName: string;
  deliveredContent: string;
  storeName?: string;
}

export async function sendDeliveryEmail({
  to,
  orderId,
  customerName,
  productName,
  deliveredContent,
  storeName = "Nossa Loja",
}: DeliveryEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "API key not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Entrega Digital <onboarding@resend.dev>",
      to: [to],
      subject: `Seu pedido #${orderId} - ${productName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #121212; color: #ffffff; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1e1e1e; border-radius: 8px; padding: 30px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #22c55e; margin: 0; }
            .content { background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .product-content { background: #333; border-left: 4px solid #22c55e; padding: 15px; margin: 15px 0; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
            h2 { color: #22c55e; }
            p { line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${escapeHtml(storeName)}</h1>
            </div>
            
            <h2>Pedido Confirmado!</h2>
            <p>Ol\u00e1${customerName ? ` ${escapeHtml(customerName)}` : ""},</p>
            <p>Seu pagamento foi confirmado e seu produto digital j\u00e1 est\u00e1 dispon\u00edvel!</p>
            
            <div class="content">
              <p><strong>Pedido:</strong> #${orderId}</p>
              <p><strong>Produto:</strong> ${escapeHtml(productName)}</p>
              
              <h3 style="color: #22c55e;">Seu Produto:</h3>
              <div class="product-content">${escapeHtml(deliveredContent)}</div>
            </div>
            
            <p>Guarde este e-mail com cuidado. Este \u00e9 o seu comprovante de compra e acesso ao produto.</p>
            
            <div class="footer">
              <p>Obrigado pela prefer\u00eancia!</p>
              <p>${escapeHtml(storeName)}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] \u2713 Delivery email sent to ${to} for order #${orderId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Exception:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}
