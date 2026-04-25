import os
os.environ["FLAGS_enable_pir_api"] = "0"
import io
import logging
import numpy as np
from PIL import Image
import pdfplumber

logging.getLogger("ppocr").setLevel(logging.WARNING)

ocr_engine = None


def _get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        print("[OCR] Loading PaddleOCR model (first use)...")
        from paddleocr import PaddleOCR
        ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch")
        print("[OCR] PaddleOCR model ready")
    return ocr_engine


def perform_ocr(file_bytes: bytes, filename: str) -> str:
    ext = filename.split(".")[-1].lower()
    extracted_text = ""

    try:
        if ext in ["jpg", "jpeg", "png"]:
            image = Image.open(io.BytesIO(file_bytes)).convert('RGB')
            img_array = np.array(image)

            result = _get_ocr_engine().ocr(img_array, det=True, rec=True, cls=True)

            if result:
                # Flatten PaddleOCR result regardless of nesting depth.
                # Versions differ: [[bbox,(text,conf)], ...] vs [[[bbox,(text,conf)], ...]]
                def _extract_lines(node):
                    if not isinstance(node, (list, tuple)) or len(node) == 0:
                        return
                    # A leaf line: [bbox, (text, conf)] where bbox is a list of 4 points
                    if (len(node) == 2
                            and isinstance(node[0], (list, tuple))
                            and isinstance(node[1], (list, tuple))
                            and len(node[1]) == 2
                            and isinstance(node[1][0], str)):
                        text, conf = node[1][0], float(node[1][1])
                        if conf > 0.3 and text.strip():
                            nonlocal extracted_text
                            extracted_text += text + "\n"
                    else:
                        for child in node:
                            _extract_lines(child)

                _extract_lines(result)

        elif ext == "pdf":
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"

        else:
            raise ValueError(f"Unsupported file formats: {ext}")

    except Exception as e:
        raise RuntimeError(f"OCR Engine processing failed: {str(e)}")

    print(f"[OCR] Extracted {len(extracted_text)} characters")
    print(f"[OCR] Preview:\n{extracted_text[:300]}")

    return extracted_text.strip()
