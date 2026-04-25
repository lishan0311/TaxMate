import os
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

# Mail server configuration
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT")),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_FROM_NAME="TaxMate Official",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_approved_report_email(email_to: str, file_path: str, month: int, ai_body: str | None = None):
    """
    Send SST-02 report email to business owner
    """
    body_html = ai_body or f"""
        Your tax audit for {month}/2026 has been reviewed and e-signed by your accountant.<br>
        <b>Your official SST-02 return is attached.</b><br>
        Please download it and submit via the MySST portal. Contact your accountant if you have any questions.
    """

    message = MessageSchema(
        subject=f"[TaxMate] SST-02 Return for {month}/2026 (Approved)",
        recipients=[email_to],
        body=f"""
        <html>
            <body>
                <p>Dear Business Owner,</p>
                <p>{body_html}</p>
                <br>
                <p><i>This email was sent automatically by TaxMate. Please do not reply directly.</i></p>
            </body>
        </html>
        """,
        subtype=MessageType.html,
        attachments=[file_path]
    )

    fm = FastMail(conf)
    await fm.send_message(message)