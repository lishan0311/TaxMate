"""
TaxMate Tax Agent - v0.4
Level 4 Agentic System:
  L1 ✅ Structured JSON extraction
  L2 ✅ Multi-step tool calling (agent decides which tools)
  L3 ✅ Adaptive behavior + cross-validation
  L4 ✅ Cross-document batch reasoning
 
Supports: Z.AI GLM (production) / Gemini (development)
"""
from dotenv import load_dotenv
import os
import json
import time
import re
 
load_dotenv()
 
# ============================================================
# LLM Engine Selection
# ============================================================
USE_GEMINI = os.getenv("USE_GEMINI", "1") == "1"
 
if USE_GEMINI:
    from google import genai
    from google.genai import types as genai_types
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    MODEL = "gemini-2.5-flash"
    print("🔧 Using Gemini (dev mode)")
else:
    from openai import OpenAI
    import httpx
    client = OpenAI(
        api_key=os.getenv("Z.AI_API_KEY"),
        base_url=os.getenv("Z.AI_BASE_URL"),
        timeout=httpx.Timeout(30.0, connect=10.0),
        max_retries=2,
    )
    MODEL = "GLM-4.5-Flash"
    print("🚀 Using Z.AI GLM (production mode)")
 
 
# ============================================================
# System Prompt (L3: Adaptive behavior rules)
# ============================================================
SYSTEM_PROMPT = """You are TaxMate, an AI tax compliance agent for Malaysian SMEs.
You have access to tools. You MUST use them — never skip tools when relevant.
 
# WORKFLOW — adapt based on what you find:
1. ALWAYS start by calling lookup_sst_rule with a relevant query about the document type you see.
2. If you find an SST number → MUST call validate_sst_number to verify format.
3. If you find a tax/SST amount → MUST call calculate_tax to cross-check the math.
4. If NO SST number is found → call lookup_sst_rule about "threshold" rules, then call flag_for_human_review.
5. If the total exceeds RM 1,000 → call lookup_sst_rule about "e-invoice" requirements.
6. If this is a food/restaurant/F&B receipt → call lookup_sst_rule about "8%" F&B service tax rates.
7. If confidence < 0.7 after your analysis → MUST call flag_for_human_review.
8. After completing all checks → call generate_tax_advice with a brief summary of what you found.
9. Finally, produce your structured JSON output.
 
You should call 3-6 tools per document. More tools = more thorough analysis.
 
# CRITICAL: Perspective
You process documents ON BEHALF OF a Malaysian SME owner (the buyer).
- Receipt/invoice FROM a supplier TO the SME → PURCHASE → "input_tax_claimable"
  (or "input_tax_not_claimable" if supplier has no valid SST number)
- Document FROM the SME TO a customer → SALE → "output_tax"
- Unclear → default to "input_tax_claimable"
- Personal use → "personal_expense"
 
# Malaysian tax context (April 2026)
- Sales Tax: 5% (specific goods) / 10% (standard manufactured goods)
- Service Tax: 6% (most services) / 8% (F&B, telecom, credit cards, parking, logistics)
- SST threshold: RM 500K annual turnover (F&B: RM 1.5M)
- E-Invoice Phase 4 (RM 1M-5M revenue): mandatory from Jan 1, 2026
- Penalties from Jan 1, 2027: RM 200-20,000 per non-compliant invoice
- SST-02 filing: bi-monthly, due within 30 days after taxable period ends
 
# Small F&B stalls without SST number
- Normal for businesses below RM 500K threshold
- Tax treatment: "input_tax_not_claimable" (NOT personal_expense)
- Severity: "low"
 
# Confidence rules
- confidence < 0.5 → tax_treatment MUST be "unclear"
- confidence 0.5-0.7 → classify but add risk flags + call flag_for_human_review
- confidence > 0.7 → classify normally
 
# Final output — STRICTLY this JSON:
{
  "doc_type": "receipt" | "b2b_invoice" | "bank_statement" | "other",
  "supplier": {"name": string|null, "tin": string|null, "sst_number": string|null},
  "date": "YYYY-MM-DD" | null,
  "amount": {"subtotal": number|null, "sst_amount": number|null, "total": number|null},
  "tax_treatment": "input_tax_claimable"|"input_tax_not_claimable"|"output_tax"|"personal_expense"|"unclear",
  "confidence": number,
  "risk_flags": [{"type": string, "severity": "low"|"medium"|"high", "description": string}],
  "reasoning": string
}
 
NEVER fabricate data. If unclear, use null. Output JSON only at the end.
"""
 
 
# ============================================================
# Tool Definitions
# ============================================================
TOOL_DEFINITIONS = {
    "lookup_sst_rule": {
        "description": "Query LHDN knowledge base for SST rules, tax rates, MSIC codes, thresholds, or E-Invoice requirements. Call this FIRST for every document.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to look up, e.g. 'service tax 6%', 'F&B threshold', 'e-invoice', 'SST format', 'input tax'"}
            },
            "required": ["query"]
        }
    },
    "validate_sst_number": {
        "description": "Verify SST registration number format against JKDM standard. Call this whenever you see an SST number.",
        "parameters": {
            "type": "object",
            "properties": {
                "sst_number": {"type": "string", "description": "The SST registration number to validate"}
            },
            "required": ["sst_number"]
        }
    },
    "calculate_tax": {
        "description": "Calculate expected SST and cross-check against the receipt's stated tax amount. Call this whenever a tax amount appears on the receipt.",
        "parameters": {
            "type": "object",
            "properties": {
                "amount": {"type": "number", "description": "Base/subtotal amount in RM before tax"},
                "rate": {"type": "number", "description": "Tax rate as decimal, e.g. 0.06 for 6%, 0.08 for 8%"}
            },
            "required": ["amount", "rate"]
        }
    },
    "flag_for_human_review": {
        "description": "Flag this document for accountant review. Call when: confidence < 0.7, missing SST number on large invoice, data ambiguous, or calculation mismatch found.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Specific reason why accountant review is needed"},
                "severity": {"type": "string", "enum": ["low", "medium", "high"]}
            },
            "required": ["reason", "severity"]
        }
    },
    "generate_tax_advice": {
        "description": "Generate a specific tax planning tip based on what was found in this document. Call this as your final tool before producing output.",
        "parameters": {
            "type": "object",
            "properties": {
                "context": {"type": "string", "description": "Brief summary: supplier type, amount, tax status, any issues found"}
            },
            "required": ["context"]
        }
    },
}
 
 
# ============================================================
# Tool Execution (L3: cross-validation in calculate_tax)
# ============================================================
def execute_tool(name: str, args: dict, ocr_text: str = "") -> str:
    """Execute a tool call and return result string."""
 
    if name == "lookup_sst_rule":
        query = args.get("query", "").lower()
        rules = [
            ("6%", "Service Tax at 6% applies to most taxable services under Service Tax Act 2018 (e.g., professional services, management services, IT services)."),
            ("8%", "Service Tax at 8% applies to: (a) credit/charge cards, (b) food & beverage — restaurants, cafes, bars with annual turnover > RM 1.5M, (c) telecommunication, (d) parking, (e) logistics services. Rate increased from 6% to 8% effective 1 March 2024."),
            ("5%", "Sales Tax at 5% applies to specific goods under Schedule 1 of Sales Tax (Rates of Tax) Order 2018, including certain food preparations, building materials, and IT equipment."),
            ("10%", "Sales Tax at 10% is the standard rate for most manufactured and imported taxable goods not covered by the 5% rate."),
            ("threshold", "SST registration is MANDATORY when annual taxable turnover exceeds RM 500,000. Special threshold for F&B industry (Group I services): RM 1,500,000. Businesses below threshold are NOT required to register and cannot charge SST."),
            ("e-invoice", "E-Invoice Phase 4: MANDATORY for businesses with annual revenue RM 1,000,000 to RM 5,000,000 from 1 January 2026. Non-compliance penalties (RM 200-20,000 per invoice) begin 1 January 2027. All B2B transactions must generate MyInvois-compliant e-invoices."),
            ("format", "SST registration number format per JKDM: 1 letter prefix + 2 digits + hyphen + 4 digits + hyphen + 8 digits. Example: P11-2508-30000123. Prefixes: J = Sales Tax (registered manufacturer), P = Service Tax (registered provider), W = Special scheme (e.g., petroleum). Any deviation from this format indicates potential invalid registration."),
            ("penalty", "Late SST-02 filing/payment penalties: 10% (first 30 days late), 25% (31-60 days), 40% (61+ days). Per Section 26 Sales Tax Act 2018 / Section 26 Service Tax Act 2018."),
            ("input tax", "Input tax credit: Under Sales Tax, registered MANUFACTURERS can claim deduction for Sales Tax paid on raw materials/components (Sales Tax Deduction mechanism). Service Tax has NO input tax credit mechanism — service tax paid is a final cost. This is a key difference from GST."),
            ("output tax", "Output tax: SST that a registered person charges on their taxable goods/services. Must be declared in SST-02 and remitted to JKDM within 30 days after the taxable period ends."),
            ("sst-02", "SST-02 is the bi-monthly return form filed with JKDM. Taxable periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec. Filing deadline: last day of the month following the taxable period (e.g., Jan-Feb due by 31 March). Must declare: total taxable sales/services, tax payable, deductions, and net tax payable."),
            ("f&b", "F&B (Food & Beverage) businesses: Service Tax registration threshold is RM 1,500,000 annual turnover (higher than standard RM 500K). Registered F&B businesses charge 8% Service Tax (not 6%). Applies to restaurants, cafes, bars, catering, private dining, food courts with AC/entertainment."),
        ]
        for keyword, rule in rules:
            if keyword in query:
                return rule
        return f"General SST guidance for '{args.get('query', '')}': Refer to JKDM SST Guidelines at mysst.customs.gov.my or consult a registered tax agent. Key principle: all taxable goods/services by registered persons must be declared in SST-02."
 
    elif name == "validate_sst_number":
        sst = args.get("sst_number", "").strip()
        pattern = r'^[A-Z]\d{2}-\d{4}-\d{8}$'
        if re.match(pattern, sst):
            prefix = sst[0]
            prefix_meanings = {
                "J": "Sales Tax — registered manufacturer",
                "P": "Service Tax — registered service provider",
                "W": "Special scheme (e.g., petroleum, designated areas)",
            }
            meaning = prefix_meanings.get(prefix, "Unknown registration category")
            return f"SST number '{sst}' is VALID. Prefix '{prefix}' = {meaning}. This supplier is SST-registered and can legitimately charge SST."
        else:
            issues = []
            if not sst:
                issues.append("Empty SST number")
            elif not sst[0].isalpha():
                issues.append(f"Invalid prefix '{sst[0]}' — must be a letter (J/P/W)")
            if '-' not in sst:
                issues.append("Missing hyphens — format should be X99-9999-99999999")
            parts = sst.split('-')
            if len(parts) == 3:
                if len(parts[2]) != 8:
                    issues.append(f"Last segment has {len(parts[2])} digits — should be 8")
            return f"SST number '{sst}' is INVALID. Issues: {'; '.join(issues) if issues else 'Does not match pattern X99-9999-99999999'}. This may indicate: (a) data entry error, (b) supplier not SST-registered, or (c) OCR misread. Recommend manual verification."
 
    elif name == "calculate_tax":
        amount = args.get("amount", 0)
        rate = args.get("rate", 0.06)
        expected_tax = round(amount * rate, 2)
        expected_total = round(amount + expected_tax, 2)
 
        result = f"Calculated: RM {amount:.2f} x {rate*100:.1f}% = SST RM {expected_tax:.2f}. Expected total: RM {expected_total:.2f}."
 
        # L3 UPGRADE: Cross-validate against receipt's actual SST amount
        sst_patterns = [
            r'SST[^RM]*RM\s*([\d,.]+)',
            r'(?:cukai|tax)[^RM]*RM\s*([\d,.]+)',
            r'SST\s*\(?\d+%?\)?\s*:?\s*RM\s*([\d,.]+)',
        ]
        actual_sst = None
        for pattern in sst_patterns:
            matches = re.findall(pattern, ocr_text, re.IGNORECASE)
            if matches:
                try:
                    actual_sst = float(matches[0].replace(',', ''))
                    break
                except ValueError:
                    continue
 
        if actual_sst is not None:
            diff = abs(actual_sst - expected_tax)
            if diff < 0.05:
                result += f" CROSS-CHECK PASSED: Receipt SST RM {actual_sst:.2f} matches calculated RM {expected_tax:.2f}. Tax calculation is correct."
            else:
                pct_diff = (diff / expected_tax * 100) if expected_tax > 0 else 0
                result += f" CROSS-CHECK WARNING: Receipt shows SST RM {actual_sst:.2f} but calculated RM {expected_tax:.2f}. Difference: RM {diff:.2f} ({pct_diff:.1f}%). Possible causes: rounding, mixed tax rates, or calculation error. Flag for accountant review."
        else:
            result += " Note: Could not find SST amount on receipt for cross-validation. May not be separately itemized."
 
        # Also check total
        total_patterns = [r'[Tt]otal[^RM]*RM\s*([\d,.]+)']
        for pattern in total_patterns:
            matches = re.findall(pattern, ocr_text)
            if matches:
                try:
                    actual_total = float(matches[-1].replace(',', ''))
                    total_diff = abs(actual_total - expected_total)
                    if total_diff < 0.05:
                        result += f" Total verification: RM {actual_total:.2f} matches expected RM {expected_total:.2f}."
                    elif total_diff > 1:
                        result += f" Total mismatch: Receipt RM {actual_total:.2f} vs expected RM {expected_total:.2f}. Difference RM {total_diff:.2f}."
                    break
                except ValueError:
                    continue
 
        return result
 
    elif name == "flag_for_human_review":
        reason = args.get("reason", "Unspecified")
        severity = args.get("severity", "medium")
        actions = {
            "low": "Document will appear in accountant's review queue as low priority. Can be batch-approved.",
            "medium": "Document requires individual accountant review before approval. Will be highlighted in review queue.",
            "high": "URGENT: Document blocked from SST-02 filing until accountant resolves this issue. Notification sent to accountant.",
        }
        return f"FLAGGED [{severity.upper()}]: {reason}. Action: {actions.get(severity, actions['medium'])}"
 
    elif name == "generate_tax_advice":
        context = args.get("context", "").lower()
        tips = []
 
        if "no sst" in context or "missing" in context or "not claimable" in context:
            tips.append("Request SST registration numbers from all regular suppliers. Without valid SST numbers, you cannot verify if tax was legitimately charged, and input tax deduction (for manufacturers) is not possible.")
        if "f&b" in context or "food" in context or "restaurant" in context or "cafe" in context:
            tips.append("F&B service tax increased to 8% from March 2024. If your business provides F&B services with turnover approaching RM 1.5M, prepare for SST registration.")
        if "large" in context or "exceed" in context or "1000" in context:
            tips.append("For invoices exceeding RM 1,000, ensure E-Invoice compliance under Phase 4 (mandatory from Jan 2026 for RM 1M-5M businesses).")
        if "mismatch" in context or "warning" in context or "error" in context:
            tips.append("Tax calculation discrepancies found. Have your accountant verify before filing SST-02 to avoid penalties (10-40% of underpaid tax).")
        if not tips:
            tips.append("Keep all original tax invoices for 7 years per JKDM requirements. Organize by taxable period for easy retrieval during audits.")
 
        return "Tax planning advice: " + " | ".join(tips)
 
    return f"Unknown tool: {name}"
 
 
# ============================================================
# Gemini Agent Runner
# ============================================================
def _run_agent_gemini(ocr_text: str, max_steps: int = 8) -> dict:
    """Multi-step agent using Gemini function calling."""
 
    gemini_tools = []
    for name, defn in TOOL_DEFINITIONS.items():
        gemini_tools.append(genai_types.Tool(
            function_declarations=[
                genai_types.FunctionDeclaration(
                    name=name,
                    description=defn["description"],
                    parameters=defn["parameters"],
                )
            ]
        ))
 
    thinking_steps = []
 
    chat = client.chats.create(
        model=MODEL,
        config=genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
            tools=gemini_tools,
        ),
    )
 
    user_msg = f"Process this Malaysian receipt/invoice. Use ALL relevant tools before producing your final JSON:\n\n{ocr_text}"
    tool_response_part = None
 
    for step in range(max_steps):
        try:
            if step == 0:
                response = chat.send_message(user_msg)
            else:
                response = chat.send_message(tool_response_part)
 
            if not response.candidates:
                thinking_steps.append({"step": step + 1, "type": "error", "action": "Empty response from model"})
                continue
 
            candidate = response.candidates[0]
            if not candidate.content or not candidate.content.parts:
                thinking_steps.append({"step": step + 1, "type": "error", "action": "No content in response"})
                continue
 
            part = candidate.content.parts[0]
 
            if part.function_call:
                fc = part.function_call
                func_name = fc.name
                func_args = dict(fc.args) if fc.args else {}
 
                thinking_steps.append({
                    "step": step + 1,
                    "type": "tool_call",
                    "action": f"Agent calls: {func_name}",
                    "input": func_args,
                })
 
                tool_result = execute_tool(func_name, func_args, ocr_text)
 
                thinking_steps.append({
                    "step": step + 1,
                    "type": "tool_result",
                    "action": "Tool returns result",
                    "output": tool_result[:500],
                })
 
                tool_response_part = genai_types.Part.from_function_response(
                    name=func_name,
                    response={"result": tool_result},
                )
 
            elif part.text:
                final_text = part.text
                thinking_steps.append({
                    "step": step + 1,
                    "type": "final_answer",
                    "action": "Agent produces final classification",
                })
 
                try:
                    cleaned = _clean_json(final_text)
                    result = json.loads(cleaned)
                    result["thinking_steps"] = thinking_steps
                    return result
                except json.JSONDecodeError:
                    return {"error": "invalid_json", "raw": final_text, "thinking_steps": thinking_steps}
 
        except Exception as e:
            print(f"⚠️ Step {step+1} error: {e}")
            thinking_steps.append({"step": step + 1, "type": "error", "action": str(e)})
            continue
 
    return {"error": "max_steps_exceeded", "thinking_steps": thinking_steps}
 
 
# ============================================================
# Z.AI (OpenAI-compatible) Agent Runner
# ============================================================
def _run_agent_openai(ocr_text: str, max_steps: int = 8) -> dict:
    """Multi-step agent using OpenAI-compatible function calling."""
 
    openai_tools = []
    for name, defn in TOOL_DEFINITIONS.items():
        openai_tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": defn["description"],
                "parameters": defn["parameters"],
            }
        })
 
    thinking_steps = []
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Process this Malaysian receipt/invoice. Use ALL relevant tools before producing your final JSON:\n\n{ocr_text}"}
    ]
 
    for step in range(max_steps):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=openai_tools,
            temperature=0.1,
            timeout=30,
        )
 
        msg = response.choices[0].message
 
        if msg.tool_calls:
            messages.append(msg)
            for tool_call in msg.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
 
                thinking_steps.append({
                    "step": step + 1,
                    "type": "tool_call",
                    "action": f"Agent calls: {func_name}",
                    "input": func_args,
                })
 
                tool_result = execute_tool(func_name, func_args, ocr_text)
 
                thinking_steps.append({
                    "step": step + 1,
                    "type": "tool_result",
                    "action": "Tool returns result",
                    "output": tool_result[:500],
                })
 
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })
        else:
            final_text = msg.content
            thinking_steps.append({
                "step": step + 1,
                "type": "final_answer",
                "action": "Agent produces final classification",
            })
 
            try:
                cleaned = _clean_json(final_text)
                result = json.loads(cleaned)
                result["thinking_steps"] = thinking_steps
                return result
            except json.JSONDecodeError:
                return {"error": "invalid_json", "raw": final_text, "thinking_steps": thinking_steps}
 
    return {"error": "max_steps_exceeded", "thinking_steps": thinking_steps}
 
 
# ============================================================
# L4: Cross-Document Batch Analysis Agent
# ============================================================
def analyze_monthly_batch(documents: list) -> dict:
    """
    Cross-document reasoning agent.
    After all receipts are processed individually, this agent
    analyzes ALL documents together to find patterns, anomalies,
    duplicates, and tax optimization opportunities.
    """
    summary_items = []
    for doc in documents:
        r = doc.get("agent_result", {})
        if not r or "error" in r:
            continue
        summary_items.append({
            "supplier": doc.get("supplier_name", "Unknown"),
            "amount": doc.get("total_amount", 0),
            "sst": r.get("amount", {}).get("sst_amount", 0),
            "tax_treatment": doc.get("tax_treatment", "unclear"),
            "date": r.get("date"),
            "risk_count": doc.get("risk_count", 0),
            "confidence": r.get("confidence", 0),
            "sst_number": r.get("supplier", {}).get("sst_number"),
        })
 
    if not summary_items:
        return {
            "batch_health": "needs_review",
            "summary": "No valid documents to analyze.",
            "duplicate_warnings": [],
            "anomalies": [],
            "tax_tips": [],
            "compliance_issues": [],
        }
 
    prompt = f"""You are a senior Malaysian tax analyst reviewing {len(summary_items)} documents for one SME's monthly SST-02 filing.
 
Analyze ALL documents TOGETHER and provide:
 
1. DUPLICATE DETECTION: Same supplier + same date + similar amount (within 10%) = potential duplicate. List any found.
2. ANOMALY DETECTION: Amounts that are >3x the average, or suppliers appearing suspiciously often. Flag unusual patterns.
3. TAX SUMMARY: Calculate total input tax claimable, input tax not claimable, output tax, and net payable.
4. TAX OPTIMIZATION: Based on spending patterns, give 2-3 SPECIFIC actionable tips to reduce net SST payable.
5. COMPLIANCE RISKS: Documents with high risk flags, missing SST numbers on large amounts, or low confidence scores.
6. SST-02 READINESS: Is this batch ready to file? What needs fixing first?
 
Documents:
{json.dumps(summary_items, indent=2, default=str)}
 
Respond ONLY with this JSON:
{{
  "batch_health": "ready" | "needs_review" | "at_risk",
  "total_documents": {len(summary_items)},
  "total_input_tax_claimable": number,
  "total_input_tax_not_claimable": number,
  "total_output_tax": number,
  "net_payable": number,
  "duplicate_warnings": [
    {{"suppliers": string, "dates": string, "amounts": string, "reason": string}}
  ],
  "anomalies": [
    {{"supplier": string, "type": "unusual_amount" | "high_frequency" | "missing_data", "description": string, "severity": "low" | "medium" | "high"}}
  ],
  "tax_tips": [
    {{"title": string, "description": string, "potential_saving": string}}
  ],
  "compliance_issues": [
    {{"issue": string, "severity": "low" | "medium" | "high", "action_needed": string, "affected_documents": number}}
  ],
  "filing_readiness": {{
    "ready_count": number,
    "needs_review_count": number,
    "blocked_count": number,
    "recommendation": string
  }},
  "summary": string
}}"""
 
    try:
        if USE_GEMINI:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config={
                    "system_instruction": "You are a Malaysian SST compliance analyst performing batch document review. Be specific with numbers and supplier names.",
                    "temperature": 0.2,
                    "response_mime_type": "application/json",
                },
            )
            return json.loads(_clean_json(response.text))
        else:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are a Malaysian SST compliance analyst. Be specific."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                timeout=60,
            )
            return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"⚠️ Batch analysis error: {e}")
        return {
            "error": str(e),
            "batch_health": "needs_review",
            "summary": f"Batch analysis failed: {str(e)}",
            "duplicate_warnings": [],
            "anomalies": [],
            "tax_tips": [],
            "compliance_issues": [],
        }
 
 
# ============================================================
# Unified Entry Points
# ============================================================
def _clean_json(raw: str) -> str:
    """Strip markdown fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
    return raw.strip()
 
 
def process_receipt(ocr_text: str, max_retries: int = 2) -> dict:
    """
    Main entry point for single-document processing.
    Runs multi-step agentic workflow with adaptive tool calling.
    """
    for attempt in range(max_retries):
        try:
            if USE_GEMINI:
                return _run_agent_gemini(ocr_text)
            else:
                return _run_agent_openai(ocr_text)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "rate limit" in error_str.lower():
                wait_time = 5 * (attempt + 1)
                print(f"⚠️ Rate limited. Waiting {wait_time}s... (retry {attempt+1}/{max_retries})")
                time.sleep(wait_time)
                continue
            print(f"⚠️ Agent error: {e}")
            import traceback
            traceback.print_exc()
            return {"error": str(e), "thinking_steps": []}
    return {"error": "max_retries_exceeded", "thinking_steps": []}
 
 
# ============================================================
# Test
# ============================================================
if __name__ == "__main__":
    # Test 1: Clean B2B invoice
    # test_1 = """
    # MR.DIY TRADING SDN BHD
    # No. 45, Jalan Kepong, 52100 Kuala Lumpur
    # SST No: W10-1234-56789012
    # TIN: 201801234567
 
    # Invoice No: INV-2026-0412-001
    # Date: 12/04/2026
 
    # Description              Qty    Price
    # Office supplies          1      80.66
 
    # Subtotal:   RM 80.66
    # SST (6%):   RM 4.84
    # Total:      RM 85.50
    # """
 
    # print("=" * 60)
    # print("Test 1: Clean B2B invoice (expect 4-6 tool calls)")
    # print("=" * 60)
 
    # result = process_receipt(test_1)
 
    # if "thinking_steps" in result:
    #     print("\n--- Agent Thinking Steps ---")
    #     for ts in result["thinking_steps"]:
    #         if ts["type"] == "tool_call":
    #             print(f"  🔧 Step {ts['step']}: {ts['action']}")
    #             if "input" in ts:
    #                 print(f"     Input: {json.dumps(ts['input'])}")
    #         elif ts["type"] == "tool_result":
    #             print(f"  📋 Step {ts['step']}: {ts['action']}")
    #             output = ts.get('output', '')
    #             # Highlight cross-check results
    #             if "CROSS-CHECK" in output:
    #                 print(f"     ⚡ {output[:200]}")
    #             elif "VALID" in output or "INVALID" in output:
    #                 print(f"     ✅ {output[:200]}")
    #             else:
    #                 print(f"     Output: {output[:150]}")
    #         elif ts["type"] == "final_answer":
    #             print(f"  ✅ Step {ts['step']}: {ts['action']}")
    #         elif ts["type"] == "error":
    #             print(f"  ❌ Step {ts['step']}: {ts['action']}")
    #     print(f"  Total tool calls: {sum(1 for s in result['thinking_steps'] if s['type'] == 'tool_call')}")
    #     print("---\n")
 
    # display = {k: v for k, v in result.items() if k != "thinking_steps"}
    # print(json.dumps(display, indent=2, ensure_ascii=False))
 
    # Test batch analysis (L4)
    print("\n\n" + "=" * 60)
    print("Test: Cross-document batch analysis")
    print("=" * 60)
 
    mock_docs = [
        {"supplier_name": "MR.DIY TRADING SDN BHD", "total_amount": 85.50, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-12", "amount": {"sst_amount": 4.84}, "confidence": 0.95, "supplier": {"sst_number": "W10-1234-56789012"}}},
        {"supplier_name": "Ali Nasi Lemak", "total_amount": 15.00, "tax_treatment": "input_tax_not_claimable", "risk_count": 1, "agent_result": {"date": "2026-04-10", "amount": {"sst_amount": None}, "confidence": 0.8, "supplier": {"sst_number": None}}},
        {"supplier_name": "SHELL MALAYSIA", "total_amount": 250.00, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-14", "amount": {"sst_amount": 15.00}, "confidence": 0.9, "supplier": {"sst_number": "J10-1234-56789012"}}},
        {"supplier_name": "MR.DIY TRADING SDN BHD", "total_amount": 86.20, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-12", "amount": {"sst_amount": 4.88}, "confidence": 0.95, "supplier": {"sst_number": "W10-1234-56789012"}}},
        {"supplier_name": "KFC Restaurant", "total_amount": 430.50, "tax_treatment": "input_tax_claimable", "risk_count": 0, "agent_result": {"date": "2026-04-15", "amount": {"sst_amount": 34.44}, "confidence": 0.7, "supplier": {"sst_number": None}}},
    ]
 
    batch_result = analyze_monthly_batch(mock_docs)
    print(json.dumps(batch_result, indent=2, ensure_ascii=False))