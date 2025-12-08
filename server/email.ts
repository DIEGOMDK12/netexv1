import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function enviarEntrega(
  email_cliente: string, 
  produto_nome: string, 
  key: string
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background: #121212; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e1e1e; border-radius: 8px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #a855f7; margin: 0; font-size: 28px; }
          .success-badge { 
            display: inline-block; 
            background: linear-gradient(135deg, #22c55e, #16a34a); 
            color: white; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 14px; 
            margin-bottom: 20px;
          }
          .content { background: #2a2a2a; border-radius: 8px; padding: 25px; margin: 20px 0; }
          .key-box { 
            background: linear-gradient(135deg, #1a1a2e, #16213e); 
            border: 2px solid #a855f7; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
            text-align: center;
          }
          .key-label { color: #a855f7; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; }
          .key-value { 
            font-family: 'Courier New', monospace; 
            font-size: 18px; 
            color: #22c55e; 
            word-break: break-all; 
            background: #0d0d0d;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #333;
          }
          .product-name { 
            color: #a855f7; 
            font-size: 20px; 
            font-weight: bold; 
            margin: 10px 0;
          }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; }
          p { line-height: 1.6; margin: 10px 0; }
          .highlight { color: #22c55e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="success-badge">Pagamento Confirmado</span>
            <h1>NexStore</h1>
          </div>
          
          <div class="content">
            <p>Ola!</p>
            <p>Seu pagamento foi confirmado com sucesso! Aqui esta sua chave de ativacao:</p>
            
            <p class="product-name">${escapeHtml(produto_nome)}</p>
            
            <div class="key-box">
              <div class="key-label">Chave de Ativacao</div>
              <div class="key-value">${escapeHtml(key)}</div>
            </div>
            
            <p><span class="highlight">Importante:</span> Guarde esta chave em um lugar seguro. Este e-mail e seu comprovante de compra.</p>
          </div>
          
          <div class="footer">
            <p>Obrigado pela preferencia!</p>
            <p>Equipe NexStore</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: "noreply@nexstore.com",
      to: email_cliente,
      subject: `Sua chave de ativacao - ${produto_nome}`,
      html: htmlContent,
    });

    if (result.error) {
      console.error("[Email] Erro ao enviar:", result.error);
      return { success: false, error: result.error.message || "Erro desconhecido" };
    }

    console.log(`[Email] Entrega enviada para ${email_cliente} - Produto: ${produto_nome}`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Erro ao enviar:", err.message);
    return { success: false, error: err.message || "Erro desconhecido" };
  }
}

export async function sendDeliveryEmail({
  to,
  orderId,
  customerName,
  productName,
  deliveredContent,
  storeName = "NexStore",
}: DeliveryEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background: #121212; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e1e1e; border-radius: 8px; padding: 30px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #a855f7; margin: 0; font-size: 28px; }
          .success-badge { 
            display: inline-block; 
            background: linear-gradient(135deg, #22c55e, #16a34a); 
            color: white; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 14px; 
            margin-bottom: 20px;
          }
          .content { background: #2a2a2a; border-radius: 8px; padding: 25px; margin: 20px 0; }
          .product-content { 
            background: linear-gradient(135deg, #1a1a2e, #16213e); 
            border: 2px solid #a855f7; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
            font-family: 'Courier New', monospace; 
            white-space: pre-wrap; 
            word-break: break-all;
            color: #22c55e;
          }
          .order-info { 
            background: #333; 
            padding: 15px; 
            border-radius: 6px; 
            margin-bottom: 20px;
          }
          .order-info p { margin: 5px 0; }
          .label { color: #888; }
          .value { color: #fff; font-weight: bold; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; }
          h2 { color: #a855f7; margin-top: 0; }
          p { line-height: 1.6; }
          .highlight { color: #22c55e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="success-badge">Pagamento Confirmado</span>
            <h1>${escapeHtml(storeName)}</h1>
          </div>
          
          <div class="content">
            <h2>Pedido Confirmado!</h2>
            <p>Ola${customerName ? ` ${escapeHtml(customerName)}` : ""},</p>
            <p>Seu pagamento foi confirmado e seu produto digital ja esta disponivel!</p>
            
            <div class="order-info">
              <p><span class="label">Pedido:</span> <span class="value">#${orderId}</span></p>
              <p><span class="label">Produto:</span> <span class="value">${escapeHtml(productName)}</span></p>
            </div>
            
            <h3 style="color: #a855f7; margin-bottom: 10px;">Sua Chave de Ativacao:</h3>
            <div class="product-content">${escapeHtml(deliveredContent)}</div>
            
            <p><span class="highlight">Importante:</span> Guarde este e-mail com cuidado. Este e o seu comprovante de compra e acesso ao produto.</p>
          </div>
          
          <div class="footer">
            <p>Obrigado pela preferencia!</p>
            <p>${escapeHtml(storeName)}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: "noreply@nexstore.com",
      to: to,
      subject: `Seu pedido #${orderId} - ${productName}`,
      html: htmlContent,
    });

    if (result.error) {
      console.error("[Email] Exception:", result.error);
      return { success: false, error: result.error.message || "Unknown error" };
    }

    console.log(`[Email] Delivery email sent to ${to} for order #${orderId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[Email] Exception:", err.message);
    return { success: false, error: err.message || "Unknown error" };
  }
}
