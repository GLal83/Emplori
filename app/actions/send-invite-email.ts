"use server"

/**
 * Send an invitation email to a new team member
 * 
 * Note: This requires Resend API key to be configured in .env.local
 * Get your API key from: https://resend.com/api-keys
 * 
 * @param email - Recipient email address
 * @param name - Recipient name
 * @param role - Role being assigned (Admin, Recruiter, Viewer)
 * @param invitedBy - Email of the person sending the invite
 */
export async function sendInviteEmail(
  email: string,
  name: string,
  role: string,
  invitedBy: string
) {
  console.log("[INVITE] Sending invitation email to:", email)

  // Check if Resend API key is configured
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    console.warn("[INVITE] RESEND_API_KEY not configured. Email will not be sent.")
    return {
      success: false,
      error: "Email service not configured. Please set RESEND_API_KEY in .env.local",
    }
  }

  try {
    // Dynamic import to avoid bundling issues if Resend is not installed
    const { Resend } = await import("resend")
    const resend = new Resend(resendApiKey)

    // Get the app URL (for the invitation link)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const inviteLink = `${appUrl}/login`

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Emplori <onboarding@resend.dev>",
      to: email,
      subject: `You've been invited to join Emplori as a ${role}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to Emplori</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Emplori</h1>
            </div>
            
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937; margin-top: 0;">You've been invited!</h2>
              
              <p style="color: #4b5563; font-size: 16px;">
                Hi ${name},
              </p>
              
              <p style="color: #4b5563; font-size: 16px;">
                ${invitedBy} has invited you to join <strong>Emplori</strong> as a <strong>${role}</strong>.
              </p>
              
              <p style="color: #4b5563; font-size: 16px;">
                Click the button below to accept your invitation and get started:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" 
                   style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${name},

${invitedBy} has invited you to join Emplori as a ${role}.

Accept your invitation by visiting: ${inviteLink}

If you didn't expect this invitation, you can safely ignore this email.
      `,
    })

    if (error) {
      console.error("[INVITE] Resend API error:", error)
      return {
        success: false,
        error: `Failed to send email: ${error.message}`,
      }
    }

    console.log("[INVITE] Email sent successfully:", data?.id)
    return {
      success: true,
      messageId: data?.id,
    }
  } catch (error) {
    console.error("[INVITE] Error sending email:", error)
    return {
      success: false,
      error: `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

