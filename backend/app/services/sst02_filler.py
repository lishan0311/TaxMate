import os
import io
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from typing import Optional

def generate_sst02_pdf(data: dict, is_draft: bool = False) -> str:
    """
    Use pypdf to directly inject data into the official SST-02 AcroForm (full field version).
    When is_draft=True, the declarant/signatory section is left blank.
    """
    # 1. Path settings
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

    # 2. Read and copy template
    reader = PdfReader(template_path)
    writer = PdfWriter()
    writer.append(reader)

    # Use pre-computed sst_amount if provided, otherwise estimate at 6%
    service_tax_val = data.get("taxable_amount_6pct", 0.0)
    service_tax_tax = data.get("sst_amount") or (service_tax_val * 0.06)
    input_tax_deduction = data.get("input_tax_deduction", 0.0)
    net_payable = max(0.0, service_tax_tax - input_tax_deduction)

    # Date of parsing
    start_d, start_m, start_y_full = data.get("period_start", "01/04/2026").split("/")
    end_d, end_m, end_y_full = data.get("period_end", "30/04/2026").split("/")
    due_d, due_m, due_y_full = "31", "05", "2026"
    today_d, today_m, today_y_full = datetime.now().strftime("%d/%m/%Y").split("/")

    start_y = start_y_full[-2:]
    end_y = end_y_full[-2:]
    due_y = due_y_full[-2:]
    today_y = today_y_full[-2:]

    # 4. Prepare a full form data dictionary
    pdf_form_data = {
        "No SST02": data.get("sst_no", ""),
        "sstreg_no": data.get("sst_no", ""),
        "sales_tax": "/Yes",
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
        "CJdeduct": f"{input_tax_deduction:.2f}",
        "CPdeduct": "0.00",
        "adjustment": "0.00",
        "totalb4penalty": f"{net_payable:.2f}",
        "percent": "0", "penalty": "0.00",
        "incPenalty": f"{net_payable:.2f}",
        "perliter": "0.00", "perkg": "0.00", "percent_advolerum": "0",
        "litre_value": "0.00", "kg_value": "0.00", "value_volerum": "0.00",
        "value_litre": "0.00", "value_kg": "0.00",
        "pay_litre": "0.00", "pay_kg": "0.00", "pay_volerum": "0.00",
        "SADA": "0.00", "scheduleA": "0.00", "scheduleB": "0.00",
        "ci": "0.00", "cii": "0.00", "exempted": "0.00",
        "CJ_12": "0.00", "CJ_34": "0.00", "item5": "0.00",
        "net_total": f"{net_payable:.2f}",
        "day_4": "" if is_draft else today_d,
        "month_4": "" if is_draft else today_m,
        "year_4": "" if is_draft else today_y,
        "declarant": "" if is_draft else data.get("declarant_name", ""),
        "ic_passport": "" if is_draft else data.get("declarant_ic", ""),
        "designation": "" if is_draft else data.get("declarant_position", ""),
        "phone": "" if is_draft else data.get("phone", "012-3456789")
    }

    # 5. Fill B1 detail rows into AcroForm fields (page 2)
    b1_rows = data.get("b1_rows", [])
    for idx in range(min(len(b1_rows), 9)):
        n = idx + 1
        row = b1_rows[idx]
        desc = (row.get("description") or "Taxable service").upper()[:30]
        code = (row.get("service_code") or "H").upper()[:6]
        taxable = float(row.get("taxable_value") or 0.0)
        sst = taxable * 0.06
        pdf_form_data[f"Bil_{n}"] = str(n)
        pdf_form_data[f"desc_{n}"] = desc
        pdf_form_data[f"tariff_{n}"] = code
        pdf_form_data[f"value_{n}"] = f"{taxable:.2f}"
        pdf_form_data[f"svc_{n}"] = f"{sst:.2f}"
        pdf_form_data[f"ownuse_{n}"] = "0.00"

    # B1 totals (fields total8, total9, total10 on page 2)
    total_value = sum(float(r.get("taxable_value", 0)) for r in b1_rows)
    total_svc = total_value * 0.06
    pdf_form_data["total8"] = f"{total_value:.2f}"
    pdf_form_data["total9"] = f"{total_svc:.2f}"
    pdf_form_data["total10"] = f"{total_value + total_svc:.2f}"

    # 6. Update all form fields across all pages
    try:
        for page in writer.pages:
            try:
                writer.update_page_form_field_values(
                    page,
                    pdf_form_data,
                    auto_regenerate=False,
                )
            except Exception:
                pass
    except Exception as e:
        print(f"Warning mapping fields: {e}")

    # 6b. Fix radio-button fields (e.g. sales_tax) that pypdf cannot set via form data.
    #     These have /Kids and need /AS set directly on each widget.
    for page in writer.pages:
        for annot in page.get("/Annots", []):
            annot_obj = annot.get_object()
            parent = annot_obj.get("/Parent")
            if parent:
                parent_obj = parent.get_object()
                field_name = parent_obj.get("/T", "")
            else:
                field_name = annot_obj.get("/T", "")

            if field_name == "sales_tax":
                ap = annot_obj.get("/AP", {})
                normal = ap.get("/N", {})
                try:
                    normal_obj = normal.get_object() if hasattr(normal, "get_object") else normal
                except Exception:
                    normal_obj = normal
                if "/Yes" in normal_obj:
                    annot_obj[NameObject("/AS")] = NameObject("/Yes")
                elif "/No" in normal_obj:
                    annot_obj[NameObject("/AS")] = NameObject("/Off")
            elif field_name == "Amendment":
                annot_obj[NameObject("/AS")] = NameObject("/Off")

    # 6. Save file
    with open(output_path, "wb") as output_stream:
        writer.write(output_stream)

    return output_path

def apply_signature_to_pdf(
    filled_pdf_path: str,
    signature_image_path: str,
    output_path: str,
    is_draft: bool = False,
):
    """
    Place a PNG signature image with a transparent background over the PDF.
    """
    filled_pdf = PdfReader(filled_pdf_path)

    # Creating a signature layer: Accountant's signature on page four
    packet_sig = io.BytesIO()
    can_sig = canvas.Canvas(packet_sig, pagesize=A4)

    if not is_draft:
        if os.path.exists(signature_image_path):
            can_sig.drawImage(signature_image_path, 350, 420, width=150, height=50, mask='auto')

    can_sig.showPage()
    can_sig.save()
    packet_sig.seek(0)
    overlay_sig = PdfReader(packet_sig).pages[0]

    # Merge signature layers
    writer = PdfWriter()

    for i, page in enumerate(filled_pdf.pages):
        if i == 3 and len(filled_pdf.pages) > 3:
            page.merge_page(overlay_sig)
        writer.add_page(page)

    with open(output_path, "wb") as output_stream:
        writer.write(output_stream)

    return output_path
