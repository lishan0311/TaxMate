# get_pdf_fields.py
from pypdf import PdfReader
import os

# 指向你的空白模板
template_path = os.path.join("templates", "SST-02 (Latest Release).pdf")

try:
    reader = PdfReader(template_path)
    fields = reader.get_fields()
    
    if fields:
        print("🎉 恭喜！在这个 PDF 中找到了以下可填写的字段：\n")
        for field_name, field_data in fields.items():
            print(f"格子名称: '{field_name}'")
    else:
        print("⚠️ 没有检测到可填写的表单字段。")
except Exception as e:
    print(f"读取出错: {e}")