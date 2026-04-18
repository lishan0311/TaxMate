import os
os.environ["FLAGS_enable_pir_api"] = "0"
import io
import logging
import numpy as np
from PIL import Image
import pdfplumber
from paddleocr import PaddleOCR

logging.getLogger("ppocr").setLevel(logging.WARNING)

print("⏳ 正在加载 PaddleOCR 模型...")
ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch")
print("✅ PaddleOCR 模型加载完成！")

def perform_ocr(file_bytes: bytes, filename: str) -> str:
    """
    根据文件后缀判断，自动提取图片或 PDF 中的文本
    """
    ext = filename.split(".")[-1].lower()
    extracted_text = ""

    try:
        # ---- 处理图片 (PNG, JPG, JPEG) ----
        if ext in ["jpg", "jpeg", "png"]:
            # 将二进制流转为 PIL Image，并统一转为 RGB 模式
            image = Image.open(io.BytesIO(file_bytes)).convert('RGB')
            # PaddleOCR 需要传入 numpy 数组
            img_array = np.array(image)
            
            # 进行 OCR 识别
            result = ocr_engine.ocr(img_array)
            
            # 提取识别出的纯文本
            # result 的结构比较深：[[[坐标1, 坐标2..], (文本, 置信度)], ...]
            if result and result[0]:
                for line in result[0]:
                    text = line[1][0]
                    extracted_text += text + "\n"
                    
        # ---- 处理 PDF 文件 ----
        elif ext == "pdf":
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
                        
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
            
    except Exception as e:
        raise RuntimeError(f"OCR 引擎处理失败: {str(e)}")
        
    return extracted_text.strip()