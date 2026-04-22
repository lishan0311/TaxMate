import os
import io
from pypdf import PdfReader, PdfWriter
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from typing import Optional

def generate_sst02_pdf(data: dict) -> str:
    """
    利用 pypdf 直接将数据注入官方 SST-02 AcroForm 表单 (全量字段版)
    """
    # 1. 路径设置
    current_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(current_dir)
    backend_dir = os.path.dirname(app_dir)
    
    template_path = os.path.join(backend_dir, "templates", "SST-02 (Latest Release).pdf")
    output_filename = f"SST02_{data.get('year')}_{data.get('month'):02d}.pdf"
    
    temp_dir = os.path.join(backend_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    output_path = os.path.join(temp_dir, output_filename)

    if not os.path.exists(template_path):
        raise FileNotFoundError(f"找不到官方模板: {template_path}")

    # 2. 读取并复制模板
    reader = PdfReader(template_path)
    writer = PdfWriter()
    writer.append(reader)

    # Use pre-computed sst_amount if provided, otherwise estimate at 6%
    service_tax_val = data.get("taxable_amount_6pct", 0.0)
    service_tax_tax = data.get("sst_amount") or (service_tax_val * 0.06)

    # 解析日期
    start_d, start_m, start_y_full = data.get("period_start", "01/04/2026").split("/")
    end_d, end_m, end_y_full = data.get("period_end", "30/04/2026").split("/")
    due_d, due_m, due_y_full = "31", "05", "2026"
    today_d, today_m, today_y_full = datetime.now().strftime("%d/%m/%Y").split("/")

    start_y = start_y_full[-2:]
    end_y = end_y_full[-2:]
    due_y = due_y_full[-2:]
    today_y = today_y_full[-2:]

    # 4. 准备全量表单数据字典
    pdf_form_data = {
        "sstreg_no": data.get("sst_no", ""),
        "registered_name": data.get("company_name", ""),
        "day_1": start_d, "month_1": start_m, "year_1": start_y, 
        "day_2": end_d,   "month_2": end_m,   "year_2": end_y,   
        "day_3": due_d,   "month_3": due_m,   "year_3": due_y,   
        "sales5": "0.00", "payable5": "0.00",
        "sales10": "0.00", "payable10": "0.00",
        "otherH": f"{service_tax_val:.2f}",
        "payableOtherH": f"{service_tax_tax:.2f}",
        "unit": "0", "card": "0.00",
        "total_payable": f"{service_tax_tax:.2f}",
        "credit_note": "0.00",
        "CJdeduct": "0.00",
        "CPdeduct": "0.00",
        "adjustment": "0.00",
        "totalb4penalty": f"{service_tax_tax:.2f}",
        "percent": "0", "penalty": "0.00",
        "incPenalty": f"{service_tax_tax:.2f}",
        "perliter": "0.00", "perkg": "0.00", "percent_advolerum": "0",
        "litre_value": "0.00", "kg_value": "0.00", "value_volerum": "0.00",
        "pay_litre": "0.00", "pay_kg": "0.00", "pay_volerum": "0.00",
        "SADA": "0.00", "scheduleA": "0.00", "scheduleB": "0.00",
        "ci": "0.00", "cii": "0.00", "exempted": "0.00",
        "CJ_12": "0.00", "CJ_34": "0.00", "item5": "0.00", "net_total": "0.00",
        "day_4": today_d, "month_4": today_m, "year_4": today_y, 
        "declarant": data.get("declarant_name", ""),
        "ic_passport": data.get("declarant_ic", ""),
        "designation": data.get("declarant_position", ""),
        "phone": data.get("phone", "012-3456789")
    }

    # 5. 更新表单字段
    try:
        for page in writer.pages:
            writer.update_page_form_field_values(page, pdf_form_data)
    except Exception as e:
         print(f"Warning mapping fields: {e}")

    # 6. 保存文件
    with open(output_path, "wb") as output_stream:
        writer.write(output_stream)

    return output_path

def apply_signature_to_pdf(
    filled_pdf_path: str,
    signature_image_path: str,
    output_path: str,
    is_draft: bool = False,
    b1_rows: Optional[list[dict]] = None,
):
    """
    将带有透明背景的 PNG 签名图片盖在 PDF 上。
    """
    # 制作图层 1：第一页的打叉 (X)
    packet_p1 = io.BytesIO()
    can_p1 = canvas.Canvas(packet_p1, pagesize=A4)
    can_p1.setFont("Helvetica-Bold", 14)
    can_p1.drawString(315, 310, "X") 
    can_p1.save()
    packet_p1.seek(0)
    overlay_p1 = PdfReader(packet_p1).pages[0]
    
    # 制作图层 2：第二页 B1 明细行
    packet_p2 = io.BytesIO()
    can_p2 = canvas.Canvas(packet_p2, pagesize=A4)
    if b1_rows:
        can_p2.setFont("Helvetica", 8)
        # B1 table layout (page 2) - up to 8 rows fits current template.
        # x positions: No | Desc | Code | Col8 | Col9 | Col10
        x_no, x_desc, x_code = 48, 92, 225
        x_col8, x_col9, x_col10 = 336, 449, 560
        start_y, row_h = 547, 17
        max_rows = 8

        for idx, row in enumerate(b1_rows[:max_rows]):
            y = start_y - (idx * row_h)
            no = str(idx + 1)
            desc = (row.get("description") or "Taxable service").upper()[:34]
            code = (row.get("service_code") or "H").upper()[:6]
            value = float(row.get("taxable_value") or 0.0)

            can_p2.drawString(x_no, y, no)
            can_p2.drawString(x_desc, y, desc)
            can_p2.drawString(x_code, y, code)
            can_p2.drawRightString(x_col8, y, f"{value:.2f}")
            can_p2.drawRightString(x_col9, y, "0.00")
            can_p2.drawRightString(x_col10, y, "0.00")
    can_p2.save()
    packet_p2.seek(0)
    overlay_p2 = PdfReader(packet_p2).pages[0]

    # 制作图层 3：第四页的会计师签名
    packet_p4 = io.BytesIO()
    can_p4 = canvas.Canvas(packet_p4, pagesize=A4)
    
    # 核心修复点：这里的 if 必须相对于函数进行缩进
    if not is_draft:
        if os.path.exists(signature_image_path):
            can_p4.drawImage(signature_image_path, 350, 420, width=150, height=50, mask='auto')
    
    can_p4.save()
    packet_p4.seek(0)
    overlay_p4 = PdfReader(packet_p4).pages[0]
    
    # 合并所有图层
    filled_pdf = PdfReader(filled_pdf_path)
    writer = PdfWriter()
    
    for i, page in enumerate(filled_pdf.pages):
        if i == 0:
            page.merge_page(overlay_p1)
        elif i == 1 and b1_rows:
            page.merge_page(overlay_p2)
        elif i == 3 and len(filled_pdf.pages) > 3:
            page.merge_page(overlay_p4)
        writer.add_page(page)
        
    with open(output_path, "wb") as output_stream:
        writer.write(output_stream)
        
    return output_path