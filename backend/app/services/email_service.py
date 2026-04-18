import os
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

# 邮件服务器配置
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

async def send_approved_report_email(email_to: str, file_path: str, month: int):
    """
    异步发送 SST-02 报告给老板
    """
    message = MessageSchema(
        subject=f"【TaxMate】2026年{month}月 SST-02 报税单（已核准）",
        recipients=[email_to],
        body=f"""
        <html>
            <body>
                <p>尊敬的老板，</p>
                <p>您的 2026 年 {month} 月税务审计已由会计师核准并完成电子签名。</p>
                <p><b>附件中为您的官方 SST-02 报税单。</b></p>
                <p>请下载并登录 MySST 系统进行申报。如有疑问，请咨询您的专属会计师。</p>
                <br>
                <p><i>此邮件由 TaxMate 系统自动发出，请勿直接回复。</i></p>
            </body>
        </html>
        """,
        subtype=MessageType.html,
        attachments=[file_path] # 直接传入文件路径
    )

    fm = FastMail(conf)
    await fm.send_message(message)