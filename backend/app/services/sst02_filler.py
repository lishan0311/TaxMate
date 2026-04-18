import os
import io
from pypdf import PdfReader, PdfWriter
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

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

    # 3. 计算税金 (当前主打 6% 服务税，其余设为 0)
    service_tax_val = data.get("taxable_amount_6pct", 0.0)
    service_tax_tax = service_tax_val * 0.06

    # 解析日期：注意年份只取后两位！ (2026 -> 26)
    start_d, start_m, start_y_full = data.get("period_start", "01/04/2026").split("/")
    end_d, end_m, end_y_full = data.get("period_end", "30/04/2026").split("/")
    due_d, due_m, due_y_full = "31", "05", "2026"
    today_d, today_m, today_y_full = datetime.now().strftime("%d/%m/%Y").split("/")

    start_y = start_y_full[-2:]
    end_y = end_y_full[-2:]
    due_y = due_y_full[-2:]
    today_y = today_y_full[-2:]

    # 4. 准备全量表单数据字典 (填满每一个格子)
    pdf_form_data = {
        # --- Part A: 基本信息 ---
        "sstreg_no": data.get("sst_no", ""),
        "registered_name": data.get("company_name", ""),
        
        "day_1": start_d, "month_1": start_m, "year_1": start_y, 
        "day_2": end_d,   "month_2": end_m,   "year_2": end_y,   
        "day_3": due_d,   "month_3": due_m,   "year_3": due_y,   

        # --- Part B: 税务金额 (没交易的全部填 0.00) ---
        "sales5": "0.00", "payable5": "0.00",           # 11(a) 5% 销售税
        "sales10": "0.00", "payable10": "0.00",         # 11(b) 10% 销售税
        
        "otherH": f"{service_tax_val:.2f}",             # 11(c) 6%/8% 应税服务总额
        "payableOtherH": f"{service_tax_tax:.2f}",      # 11(c) 6%/8% 应缴税金
        
        "unit": "0", "card": "0.00",                    # 11(d) 信用卡 RM 25 税
        
        "total_payable": f"{service_tax_tax:.2f}",      # 12) 总税金
        
        "credit_note": "0.00",                          # 13(a) 减免
        "CJdeduct": "0.00",                             # 13(b)
        "CPdeduct": "0.00",                             # 13(c)
        "adjustment": "0.00",                           # 13A
        
        "totalb4penalty": f"{service_tax_tax:.2f}",     # 14) 罚款前总额
        "percent": "0", "penalty": "0.00",              # 15) 罚款
        "incPenalty": f"{service_tax_tax:.2f}",         # 16) 包含罚款最终总额

        # --- Part C & D & E: 其它杂项全部置零 ---
        "perliter": "0.00", "perkg": "0.00", "percent_advolerum": "0",
        "litre_value": "0.00", "kg_value": "0.00", "value_volerum": "0.00",
        "pay_litre": "0.00", "pay_kg": "0.00", "pay_volerum": "0.00",
        "SADA": "0.00", "scheduleA": "0.00", "scheduleB": "0.00",
        "ci": "0.00", "cii": "0.00", "exempted": "0.00",
        "CJ_12": "0.00", "CJ_34": "0.00", "item5": "0.00", "net_total": "0.00",

        # --- Part F: 签字与声明 ---
        "day_4": today_d, "month_4": today_m, "year_4": today_y, 
        "declarant": data.get("declarant_name", ""),
        "ic_passport": data.get("declarant_ic", ""),
        "designation": data.get("declarant_position", ""),
        "phone": "012-3456789"
    }

    # 5. 更新表单字段
    try:
        writer.update_page_form_field_values(writer.pages[0], pdf_form_data)
        for page in writer.pages:
            writer.update_page_form_field_values(page, pdf_form_data)
    except Exception as e:
         print(f"Warning mapping fields: {e}")

    # 6. 保存文件
    with open(output_path, "wb") as output_stream:
        writer.write(output_stream)

    return output_path

def apply_signature_to_pdf(filled_pdf_path: str, signature_image_path: str, output_path: str):

    """
    将带有透明背景的 PNG 签名图片盖在 PDF 上。
    同时修复官方 PDF 漏设 '服务税' Checkbox 的 Bug，强行画一个 X！
    """
    # ==========================================
    # 制作图层 1：第一页的打叉 (X)
    # ==========================================
    packet_p1 = io.BytesIO()
    can_p1 = canvas.Canvas(packet_p1, pagesize=A4)
    can_p1.setFont("Helvetica-Bold", 14)
    # 坐标精确对准 CUKAI PERKHIDMATAN / SERVICE TAX 的方框
    can_p1.drawString(315, 310, "X") 
    can_p1.save()
    packet_p1.seek(0)
    overlay_p1 = PdfReader(packet_p1).pages[0]
    
    # ==========================================
    # 制作图层 2：第四页的会计师签名
    # ==========================================
    packet_p4 = io.BytesIO()
    can_p4 = canvas.Canvas(packet_p4, pagesize=A4)
    
    # 盖上签名图片
    if os.path.exists(signature_image_path):
        can_p4.drawImage(signature_image_path, 350, 420, width=150, height=50, mask='auto')
    can_p4.save()
    packet_p4.seek(0)
    overlay_p4 = PdfReader(packet_p4).pages[0]
    
    # ==========================================
    # 合并所有图层到原本的 PDF
    # ==========================================
    filled_pdf = PdfReader(filled_pdf_path)
    writer = PdfWriter()
    
    for i, page in enumerate(filled_pdf.pages):
        if i == 0:
            # 第一页：盖上打叉图层
            page.merge_page(overlay_p1)
        elif i == 3:
            # 第四页 (Index 3)：盖上签名图层
            page.merge_page(overlay_p4)
            
        writer.add_page(page)
        
    # 导出最终的完美版 PDF
    with open(output_path, "wb") as output_stream:
        writer.write(output_stream)
        
    return output_path

    